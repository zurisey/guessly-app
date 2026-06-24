# Guessly: Kuis Interaktif Multiplayer

Guessly adalah aplikasi kuis interaktif berbasis *real-time* yang menggabungkan elemen seru ala Kahoot dengan mekanisme tebak kata menantang ala Wordle. Proyek ini dibangun untuk mendukung pembelajaran interaktif di kelas secara daring maupun luring.

## Fitur Utama
* **Host Mode:** Guru dapat membuat kuis privat atau membagikan kuis dari *Database* publik.
* **Discover System:** Jelajahi kumpulan kuis yang sudah dibuat oleh mentor lain.
* **Multiplayer Real-time:** Mendukung banyak pemain dalam satu sesi permainan menggunakan *Game PIN*.
* **Mode Solo (Latihan):** Pemain bisa berlatih sendiri dengan sistem penilaian otomatis.
* **Podium:** Tampilan akhir permainan untuk menunjukkan pemenang.
* **Mobile-Friendly:** Dioptimalkan untuk layar sentuh dengan responsivitas tinggi.

## Teknologi yang Digunakan
* **Backend:** Node.js, Express.js
* **Komunikasi:** Socket.io (Real-time events)
* **Frontend:** HTML5, CSS3, Vanilla JavaScript (Tanpa framework berat agar ringan di browser HP)

## Cara Instalasi
1. Pastikan Anda telah menginstal [Node.js](https://nodejs.org/).
2. Clone repository ini:
   ```bash
   git clone https://github.com/zurisey/guessly-app.git