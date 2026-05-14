document.addEventListener('DOMContentLoaded', () => {
    const gameMode = document.getElementById('gameMode');
    const eloSelf = document.getElementById('eloSelf');
    const eloOppo = document.getElementById('eloOppo');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    // 1. Load Data Saat Popup Dibuka
    chrome.storage.local.get(['gameMode', 'eloSelf', 'eloOppo'], (data) => {
        if (data.gameMode) gameMode.value = data.gameMode;
        if (data.eloSelf) eloSelf.value = data.eloSelf;
        if (data.eloOppo) eloOppo.value = data.eloOppo;
    });

    // 2. Simpan Data Saat Tombol Ditekan
    saveBtn.addEventListener('click', () => {
        chrome.storage.local.set({
            gameMode: gameMode.value,
            eloSelf: parseInt(eloSelf.value),
            eloOppo: parseInt(eloOppo.value)
        }, () => {
            // Tampilkan notifikasi berhasil
            status.style.display = 'block';
            setTimeout(() => { status.style.display = 'none'; }, 1500);
        });
    });
});

