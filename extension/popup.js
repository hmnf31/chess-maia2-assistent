const PERSONA_DESCS = {
  beginner: "Suka serang, suka blunder, exciting",
  club_player: "Main solid seperti pemain klub mingguan",
  tournament: "Solid, jarang blunder, konsisten",
  talented_youth: "Agresif, tajam, suka taktik",
  master: "Endgame kuat, jarang salah, presisi",
  joker: "Anti-metode, unpredictable, chaos"
};

document.addEventListener("DOMContentLoaded", () => {
  const personaSelect = document.getElementById("personaSelect");
  const personaDesc = document.getElementById("personaDesc");
  const gameMode = document.getElementById("gameMode");
  const eloSelf = document.getElementById("eloSelf");
  const eloOppo = document.getElementById("eloOppo");
  const arrowToggle = document.getElementById("arrowToggle");
  const multiLineToggle = document.getElementById("multiLineToggle");
  const evalToggle = document.getElementById("evalToggle");
  const blunderToggle = document.getElementById("blunderToggle");
  const analysisToggle = document.getElementById("analysisToggle");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");

  personaSelect.addEventListener("change", () => {
    personaDesc.textContent = PERSONA_DESCS[personaSelect.value] || "";
  });

  chrome.storage.local.get([
    "personaSelect", "gameMode", "eloSelf", "eloOppo",
    "arrowToggle", "multiLineToggle", "evalToggle", "blunderToggle", "analysisToggle"
  ], (data) => {
    if (data.personaSelect) { personaSelect.value = data.personaSelect; personaDesc.textContent = PERSONA_DESCS[data.personaSelect] || ""; }
    if (data.gameMode) gameMode.value = data.gameMode;
    if (data.eloSelf) eloSelf.value = data.eloSelf;
    if (data.eloOppo) eloOppo.value = data.eloOppo;
    if (data.arrowToggle !== undefined) arrowToggle.checked = data.arrowToggle;
    if (data.multiLineToggle !== undefined) multiLineToggle.checked = data.multiLineToggle;
    if (data.evalToggle !== undefined) evalToggle.checked = data.evalToggle;
    if (data.blunderToggle !== undefined) blunderToggle.checked = data.blunderToggle;
    if (data.analysisToggle !== undefined) analysisToggle.checked = data.analysisToggle;
  });

  saveBtn.addEventListener("click", () => {
    chrome.storage.local.set({
      personaSelect: personaSelect.value,
      gameMode: gameMode.value,
      eloSelf: parseInt(eloSelf.value),
      eloOppo: parseInt(eloOppo.value),
      arrowToggle: arrowToggle.checked,
      multiLineToggle: multiLineToggle.checked,
      evalToggle: evalToggle.checked,
      blunderToggle: blunderToggle.checked,
      analysisToggle: analysisToggle.checked,
      modelSelect: gameMode.value
    }, () => {
      status.style.display = "block";
      setTimeout(() => { status.style.display = "none"; }, 1500);
    });
  });
});
