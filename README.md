<div align="center">
  <img src="logo.svg" width="96" height="96" alt="Aperture Logo" />

  # Aperture
  **AI Image Generation Studio**

  <p align="center">
    A complete, production-quality AI image generation studio designed with a distinctive, true monochrome, darkroom-inspired UI. Every generation is treated like a numbered exposure on a roll of film, rendered in a print-like layout.
  </p>

  [![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
  [![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python)](https://python.org)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
  [![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-222?style=flat-square&logo=github)](https://satiricalguru.github.io/Aperture)

  ### 🌐 [**View Live Demo →**](https://satiricalguru.github.io/Aperture)
</div>

---

## ✨ Features

- **Darkroom UI:** An immersive, pure monochrome interface that feels like a professional photo development studio.
- **Roll of Film Experience:** Each generation is treated as an exposure (No. 001, No. 002), with seamless downloading and deleting right from the frame.
- **Multi-Model Support:** Built-in support for **Flux Free**, **Gemini**, and more, with a dynamic fallback system to ensure your generations always succeed.
- **Aspect Ratio Control:** Frame your shots exactly how you want them (1:1, 16:9, 9:16, 4:5).

---

## 📸 Screenshots

*Screenshots showcasing the monochrome darkroom UI, contact sheets, and model configurations will go here.*

<!-- Add screenshots here: <img src="path/to/screenshot.png" width="100%" /> -->

---

## 🛠 Technical Stack

### Frontend
- **Next.js 15:** Built on the latest features with Turbopack.
- **Tailwind CSS v4:** Beautiful, responsive, and easily customized styling.
- **Framer Motion & Lucide Icons:** Smooth micro-animations and crisp scalable vector graphics.

### Backend
- **FastAPI:** High-performance async Python backend.
- **SQLAlchemy & SQLite:** Zero-setup database with a seamless one-line migration path to Postgres.
- **Local Storage:** Static local storage for generated frames, with a modular architecture ready for AWS S3/Cloudflare R2 migration.

---

## 🚀 Getting Started

### 1. Environment Configuration

Clone the environment template and configure your API keys (or run in keyless mode using Flux Free):

```bash
cp .env.example .env
```

### 2. Fast Launch (Recommended)

Start both the backend and frontend simultaneously with our built-in launch script. It will automatically install dependencies and open the studio in your browser!

```bash
./start.sh
```

---

### Manual Setup (Alternative)

<details>
<summary><strong>Backend Setup</strong></summary>

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Setup virtual environment and install packages:
   ```bash
   uv venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   uv pip install -r requirements.txt
   ```
3. Launch the FastAPI server:
   ```bash
   uvicorn main:app --port 8000 --reload
   ```
</details>

<details>
<summary><strong>Frontend Setup</strong></summary>

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Turbopack development server:
   ```bash
   npm run dev
   ```
</details>

## 💻 Local Generation Mode (Zero-API-Key)

Aperture supports a fully local, zero-cost, and private generation mode that runs on your machine's own GPU using local companion applications: **Draw Things** on macOS and **ComfyUI** on Windows. 

### How it works
Since web servers cannot access the client's `127.0.0.1` address directly due to networking sandboxes, Aperture routes local generations entirely in the user's browser:
1. The browser sends the prompt and configurations directly to the companion app's local API port.
2. The generated image bytes are then sent back to the Aperture backend `/generations/import` route to save to the database and render on the contact sheet.

---

### MacOS Setup (Draw Things)
1. Select **Local (Free)** in the Selected Model dial.
2. If Draw Things is not installed, click **Download Draw Things** in the modal. Aperture will automatically run commands to install Draw Things via Homebrew Cask:
   ```bash
   brew install --cask draw-things
   ```
3. Open the **Draw Things** application.
4. Enable the local API server: Go to **Settings** → scroll to **Advanced** → enable **"API Server"** (runs HTTP API on `http://127.0.0.1:7860`).
5. Click **Check again** or **Launch Draw Things** in Aperture to connect.

---

### Windows Setup (ComfyUI)
1. Select **Local (Free)** in the Selected Model dial.
2. If ComfyUI is not installed, click **Download ComfyUI**. Aperture will automatically clone the repository into `local_engines/comfyui` in your project folder:
   ```bash
   git clone https://github.com/comfyanonymous/ComfyUI.git local_engines/comfyui
   ```
3. Open ComfyUI and run the server (starts on `http://127.0.0.1:8188` by default).
4. Ensure you have downloaded at least one checkpoint model (e.g. SDXL, SD 1.5, or Flux) and placed it in the `models/checkpoints/` directory.
5. Click **Check again** in Aperture to connect.

---

## 🏗 Architecture & Scaling

- **Database Swaps:** Update `DATABASE_URL` in `.env` to a Postgres connection string. SQLAlchemy's pooling handles the rest automatically.
- **Cloud Storage:** Implement the `ImageStorage` protocol (in `backend/storage/local_storage.py`) to swap from local storage to S3 or R2 buckets seamlessly.
- **Authentication:** The app currently uses anonymous signed sessions. You can easily integrate NextAuth (Auth.js) and update FastAPI to decode JWT payloads for complete user authentication.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

<br />

<div align="center">
  <i>Developed in the Darkroom.</i>
</div>
