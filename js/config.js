// FORGE: whose copy this is.
// This is the ONLY file that differs between copies of FORGE.
// When updating this copy from the main app, copy every file EXCEPT this one.
// Both addresses are blank on purpose: this copy keeps its data on the phone
// and never talks to a Google Sheet.

const FORGE_CONFIG = {
  owner: "Uncle",
  sheetsWebhookUrl: "",
  sheetsViewUrl: "",
  // v0.28: he logged dumbbell moves as both hands combined. The app now asks
  // for one dumbbell, so his older entries are halved once at launch. Safe to
  // leave on: anything already per hand is marked and never halved again.
  // Listed by name so a move flagged later is never halved without a decision.
  // The first eight were halved in v0.28; chest-supported row added in v0.30.1.
  halveDumbbellHistory: [
    "db-incline-press", "db-lateral-raise", "db-shrugs", "db-hammer-curls",
    "farmer-carry", "bulgarian-split-squat", "walking-lunges", "rear-delt-flyes",
    "chest-supported-row"
  ]
};
