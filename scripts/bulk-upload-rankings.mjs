/**
 * Upload a world skills rankings CSV to Firestore.
 *
 * Usage:  node scripts/bulk-upload-rankings.mjs path/to/rankings.csv
 *
 * Expected CSV columns (from RobotEvents world skills standings export):
 *   Rank, Team, Driver, Programming, Highest Driver, Highest Programming, Combined
 *
 * If your CSV has different column names, update the column mapping below.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

// ── Load env from .env.local ──
const envText = readFileSync(".env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx === -1) continue;
  const key = line.slice(0, idx).trim();
  let val = line.slice(idx + 1).trim();
  // Strip surrounding quotes
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

// ── Firebase init ──
initializeApp({
  credential: cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

// ── Parse CSV ──
function parseCSV(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must have at least a header row and one data row");

  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());

  console.log("Detected columns:", headers);

  // Map columns to match RobotEvents skills standings CSV
  const rankCol = headers.findIndex((h) => h === "rank");
  const teamCol = headers.findIndex((h) => h === "team number" || h === "team");
  const driverCol = headers.findIndex((h) => h === "highest driver skills" || h === "driver skills");
  const progCol = headers.findIndex((h) => h === "highest autonomous coding skills" || h === "autonomous coding skills");
  const combinedCol = headers.findIndex((h) => h === "score" || h === "combined");

  if (teamCol === -1) throw new Error("Could not find 'Team' column in CSV");

  console.log(`Column mapping: rank=${rankCol}, team=${teamCol}, driver=${driverCol}, prog=${progCol}, combined=${combinedCol}`);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const teamNumber = cols[teamCol]?.replace(/"/g, "");
    if (!teamNumber) continue;

    const driver = driverCol >= 0 ? parseInt(cols[driverCol]) || 0 : 0;
    const programming = progCol >= 0 ? parseInt(cols[progCol]) || 0 : 0;
    const combined = combinedCol >= 0 ? parseInt(cols[combinedCol]) || 0 : driver + programming;

    rows.push({ teamNumber, driver, programming, combined });
  }

  // Sort by combined descending and assign ranks
  rows.sort((a, b) => b.combined - a.combined);
  let rank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].combined < rows[i - 1].combined) rank = i + 1;
    rows[i].rank = rank;
  }

  return rows;
}

// ── Main ──
async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: node scripts/bulk-upload-rankings.mjs <path-to-csv>");
    process.exit(1);
  }

  console.log(`Reading CSV: ${csvPath}`);
  const csvText = readFileSync(csvPath, "utf8");
  const teams = parseCSV(csvText);

  console.log(`Parsed ${teams.length} teams`);
  console.log("Top 10:");
  for (const t of teams.slice(0, 10)) {
    console.log(`  #${t.rank} ${t.teamNumber} — ${t.combined} (D:${t.driver} P:${t.programming})`);
  }

  // Write to Firestore in batches
  console.log(`\nUploading ${teams.length} teams to Firestore...`);
  const updatedAt = new Date().toISOString();

  for (let i = 0; i < teams.length; i += 500) {
    const batch = db.batch();
    for (const team of teams.slice(i, i + 500)) {
      const ref = db.collection("skills_rankings").doc(team.teamNumber);
      batch.set(ref, {
        rank: team.rank,
        teamNumber: team.teamNumber,
        teamId: 0, // CSV doesn't have team IDs
        driver: team.driver,
        programming: team.programming,
        combined: team.combined,
        updatedAt,
      });
    }
    await batch.commit();
    console.log(`  Batch ${Math.floor(i / 500) + 1} committed (${Math.min(i + 500, teams.length)}/${teams.length})`);
  }

  // Write metadata
  await db.collection("skills_rankings").doc("_meta").set({
    lastUpdated: updatedAt,
    totalTeams: teams.length,
    source: "csv",
    seasonId: 197,
  });

  console.log(`\nDone! ${teams.length} teams uploaded to Firestore.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
