/* ═══════════════════════════════════════════════════════════
   TORNEO.JS — Logica condivisa tra admin.html e index.html
   ═══════════════════════════════════════════════════════════ */

const TEAMS_A = [
  "I MURATORI DI MAPELLO", "THE ORIGINAL DRINK TEAM", "LAS PEZIA",
  "IL TENERO GIACOMO", "IL SECONDO VERDE", "TEAM OF TOOLS",
];
const TEAMS_B = [
  "THE UNDERDOGS", "CRM MARKETING & SALES", "CORTO MUSO FC",
  "AMARO LUCIANO", "OLDIES BUT GOLDIES", "GLI ASTIGMATICI",
];

const C = {
  A: "#e85d26", B: "#2d7dd2", BG: "#1a1a2e", CARD: "#16213e", CARD2: "#1a2744",
  TXT: "#e8e8e8", DIM: "#8899aa", GOLD: "#f0c040", GREEN: "#44bb77", RED: "#e05555",
};

/* ── Round Robin (circle method) ── */
function generateRoundRobin(teams) {
  const n = teams.length, rounds = [], list = [...teams];
  for (let r = 0; r < n - 1; r++) {
    const rm = [];
    for (let i = 0; i < n / 2; i++) rm.push([list[i], list[n - 1 - i]]);
    rounds.push(rm);
    const last = list.pop(); list.splice(1, 0, last);
  }
  return rounds;
}

/* ── Risultato partita ──
   results[key] = { sets: [[3,5],[6,4],[6,2]], winner: "TEAM" }
   Ogni set: [golHome, golAway], max 6-X o 5-6/6-5 per vantaggi.
   Vince chi prende 2 set su 3 (best of 3).
*/

function getMatchWinner(matchData) {
  if (!matchData || !matchData.sets) return null;
  const sets = matchData.sets;
  let wHome = 0, wAway = 0;
  for (const s of sets) {
    if (s[0] > s[1]) wHome++; else if (s[1] > s[0]) wAway++;
  }
  if (wHome >= 2) return matchData.home;
  if (wAway >= 2) return matchData.away;
  return null; // non ancora completa
}

function getMatchGoals(matchData, teamName) {
  if (!matchData || !matchData.sets) return { gf: 0, gs: 0 };
  let gf = 0, gs = 0;
  const isHome = matchData.home === teamName;
  for (const s of matchData.sets) {
    if (isHome) { gf += s[0]; gs += s[1]; }
    else { gf += s[1]; gs += s[0]; }
  }
  return { gf, gs };
}

function isMatchComplete(matchData) {
  return getMatchWinner(matchData) !== null;
}

/* ── Classifica con classifica avulsa ──
   Criteri di ordinamento:
   1. Punti
   2. A parità di punti (2+ squadre): classifica avulsa
      a. Punti negli scontri diretti tra le squadre a pari punti
      b. Differenza reti negli scontri diretti
      c. Differenza reti generale
*/

function getStandings(group, results, roundsForGroup, teamsForGroup) {
  const teams = teamsForGroup;
  const rounds = roundsForGroup;
  const stats = {};
  teams.forEach(t => { stats[t] = { name: t, points: 0, wins: 0, played: 0, gf: 0, gs: 0 }; });

  // Raccogliamo anche tutti i match completati per gli scontri diretti
  const matchesByPair = {}; // "teamA|||teamB" -> [matchData, ...]

  rounds.forEach((rd, ri) => rd.forEach((m, mi) => {
    const key = `${group}-${ri}-${mi}`;
    const md = results[key];
    if (!md || !isMatchComplete(md)) return;

    const winner = getMatchWinner(md);
    const home = m[0], away = m[1];

    stats[home].played++;
    stats[away].played++;
    if (winner) {
      stats[winner].points++;
      stats[winner].wins++;
    }

    // Gol totali
    for (const s of md.sets) {
      stats[home].gf += s[0]; stats[home].gs += s[1];
      stats[away].gf += s[1]; stats[away].gs += s[0];
    }

    // Salva per scontri diretti
    const pairKey = [home, away].sort().join("|||");
    if (!matchesByPair[pairKey]) matchesByPair[pairKey] = [];
    matchesByPair[pairKey].push({ home, away, sets: md.sets, winner });
  }));

  // Aggiungi differenza reti
  teams.forEach(t => { stats[t].gd = stats[t].gf - stats[t].gs; });

  const arr = teams.map(t => stats[t]);

  // Funzione per calcolare classifica avulsa di un sottoinsieme di squadre
  function avulsaSort(tiedTeams) {
    if (tiedTeams.length <= 1) return tiedTeams;

    const tiedNames = new Set(tiedTeams.map(t => t.name));

    // Calcola stats solo scontri diretti tra le tiedTeams
    const avStats = {};
    tiedTeams.forEach(t => { avStats[t.name] = { pts: 0, gf: 0, gs: 0 }; });

    for (const [pairKey, matches] of Object.entries(matchesByPair)) {
      const [a, b] = pairKey.split("|||");
      if (!tiedNames.has(a) || !tiedNames.has(b)) continue;
      for (const match of matches) {
        if (match.winner && tiedNames.has(match.winner)) {
          avStats[match.winner].pts++;
        }
        for (const s of match.sets) {
          avStats[match.home].gf += s[0]; avStats[match.home].gs += s[1];
          avStats[match.away].gf += s[1]; avStats[match.away].gs += s[0];
        }
      }
    }

    // Ordina per: punti avulsi, diff reti avulsa, diff reti generale
    tiedTeams.sort((a, b) => {
      const pa = avStats[a.name].pts, pb = avStats[b.name].pts;
      if (pa !== pb) return pb - pa;
      const gda = avStats[a.name].gf - avStats[a.name].gs;
      const gdb = avStats[b.name].gf - avStats[b.name].gs;
      if (gda !== gdb) return gdb - gda;
      return b.gd - a.gd;
    });

    return tiedTeams;
  }

  // Prima ordina per punti
  arr.sort((a, b) => b.points - a.points);

  // Poi applica classifica avulsa ai gruppi a pari punti
  const finalArr = [];
  let i = 0;
  while (i < arr.length) {
    let j = i;
    while (j < arr.length && arr[j].points === arr[i].points) j++;
    const tied = arr.slice(i, j);
    if (tied.length > 1) {
      const sorted = avulsaSort(tied);
      finalArr.push(...sorted);
    } else {
      finalArr.push(...tied);
    }
    i = j;
  }

  return finalArr;
}

function allGroupMatchesPlayed(results, roundsA, roundsB) {
  const totalA = roundsA.reduce((s, r) => s + r.length, 0);
  const totalB = roundsB.reduce((s, r) => s + r.length, 0);
  let completed = 0;
  for (const key in results) {
    if (isMatchComplete(results[key])) completed++;
  }
  return completed >= totalA + totalB;
}

/* ── Formattazione set ── */
function formatSets(matchData) {
  if (!matchData || !matchData.sets || matchData.sets.length === 0) return "";
  return matchData.sets.map(s => `${s[0]}-${s[1]}`).join("  ");
}
