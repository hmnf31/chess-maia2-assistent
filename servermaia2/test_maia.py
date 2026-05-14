import os
import sys
import torch

# Pastikan path mengarah ke folder utama
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    # Mengimpor langsung dari sub-modul
    from maia2 import model, inference
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"✅ Modul Terdeteksi. Mencoba load model pada: {device}")

    # PENTING: Jika from_pretrained error, kita cek manual fungsinya
    print("⏳ Sedang mengunduh/memuat weights...")
    maia_model = model.from_pretrained(type="blitz", device=device)
    
    print("✨ HASIL: MAIA-2 SUKSES DIMUAT!")
except AttributeError:
    print("❌ ERROR: Struktur folder maia2 salah (Nested Folder).")
    print("Pastikan file model.py berada langsung di dalam folder maia2 utama.")
except Exception as e:
    print(f"❌ Terjadi kesalahan: {e}")

    