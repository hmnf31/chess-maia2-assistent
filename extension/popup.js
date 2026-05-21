const PERSONA_DESCS = {
  beginner: "Suka serang, suka blunder, exciting",
  club_player: "Main solid seperti pemain klub mingguan",
  tournament: "Solid, jarang blunder, konsisten",
  talented_youth: "Agresif, tajam, suka taktik",
  master: "Endgame kuat, jarang salah, presisi",
  joker: "Anti-metode, unpredictable, chaos"
};

document.addEventListener("DOMContentLoaded", () => {
  const serverUrl = document.getElementById("serverUrl");
  const testBtn = document.getElementById("testBtn");
  const serverDot = document.getElementById("serverDot");
  const serverLabel = document.getElementById("serverLabel");
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

  function setServerStatus(state, msg) {
    serverDot.className = "server-dot " + state;
    serverLabel.textContent = msg;
  }

  async function testConnection(url) {
    setServerStatus("checking", "Testing...");
    try {
      let resp = await fetch(url.replace(/\/+$/, "") + "/personas", { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        setServerStatus("online", "Online");
        return true;
      }
      setServerStatus("offline", "Error " + resp.status);
      return false;
    } catch (e) {
      setServerStatus("offline", "Unreachable");
      return false;
    }
  }

  chrome.storage.local.get([
    "serverUrl", "personaSelect", "gameMode", "eloSelf", "eloOppo",
    "arrowToggle", "multiLineToggle", "evalToggle", "blunderToggle", "analysisToggle"
  ], async (data) => {
    if (data.serverUrl) serverUrl.value = data.serverUrl;
    if (data.personaSelect) { personaSelect.value = data.personaSelect; personaDesc.textContent = PERSONA_DESCS[data.personaSelect] || ""; }
    if (data.gameMode) gameMode.value = data.gameMode;
    if (data.eloSelf) eloSelf.value = data.eloSelf;
    if (data.eloOppo) eloOppo.value = data.eloOppo;
    if (data.arrowToggle !== undefined) arrowToggle.checked = data.arrowToggle;
    if (data.multiLineToggle !== undefined) multiLineToggle.checked = data.multiLineToggle;
    if (data.evalToggle !== undefined) evalToggle.checked = data.evalToggle;
    if (data.blunderToggle !== undefined) blunderToggle.checked = data.blunderToggle;
    if (data.analysisToggle !== undefined) analysisToggle.checked = data.analysisToggle;
    await testConnection(serverUrl.value);
  });

  testBtn.addEventListener("click", async () => {
    await testConnection(serverUrl.value);
  });

  saveBtn.addEventListener("click", async () => {
    chrome.storage.local.set({
      serverUrl: serverUrl.value,
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
      status.className = "show";
      setTimeout(() => { status.className = ""; }, 1500);
      testConnection(serverUrl.value);
    });
  });
});
