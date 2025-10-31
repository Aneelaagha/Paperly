<p align="center">
  <img src="assets/icon128.jpeg" alt="Paperly Logo" width="60"/>
</p>

<h1 align="center"><b>Paperly</b></h1>
<p align="center"><i>Cite. Summarize. Humanize. Translate. All in one click.</i></p>


## 🧰 Built With

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black&style=for-the-badge)
![HTML](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white&style=for-the-badge)
![CSS](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white&style=for-the-badge)
![Gemini Nano](https://img.shields.io/badge/Gemini_Nano_AI-34A853?style=for-the-badge&logo=google)

## 🧠 Description

**Meet Paperly — your smart reading buddy for the web.**  
Whether you’re exploring research papers, blogs, or news articles, Paperly helps you **summarize, humanize, translate**, and **cite** content instantly.

It’s **fast**, **private**, and works completely **offline** with **Chrome’s built-in AI** — no servers, no sign-ups, just pure productivity right inside your browser.

## 📥 How to Install Paperly (Manually)

To install **Paperly** manually in Google Chrome, first download or clone this repository by visiting [https://github.com/Aneelaagha/Paperly](https://github.com/Aneelaagha/Paperly). You can either run `git clone https://github.com/Aneelaagha/Paperly.git` in your terminal or click the green **Code** button and select **Download ZIP**, then extract the contents to your system.

Next, open **Google Chrome** and go to `chrome://extensions/`. At the top right, enable **Developer Mode** using the toggle switch. Then click the **Load unpacked** button and select the `extension/` folder from the cloned or extracted project directory.

Once loaded, the **Paperly** icon will appear in your Chrome toolbar, ready to use.

👉 You can also download it directly from:
https://aneelaagha.com/paperly/

✅ **Paperly works fully offline and does not require any sign-in**  
🧠 **Powered by Chrome’s built-in Gemini Nano AI**

## ⚙️ How It Works

**Paperly** is a lightweight Chrome extension powered by **Gemini Nano**, Google’s on-device AI model integrated into the Chrome browser. It runs completely offline and securely inside your browser, without sending any data to external servers.

Once installed, Paperly injects a minimal script into webpages you visit, enabling the following functionality:

- 🔍 **Summarize** – Extracts the main ideas from long articles using Summarizer API
- ✍️ **Rewrite** – Transforms complex or academic text into clear, natural language using  Rewriter API
- 🌐 **Translate** – Uses translator API and translate text into your preferred language. 
- 📚 **Cite** – Paperly uses custom JavaScript functions to generate **APA**, **MLA**, and **Chicago** citations. It extracts metadata from the webpage (author, title, date) using HTML meta tags and content structure, then formats it using local logic — all without any external API calls.

All processing happens **locally in your browser** using Chrome’s built-in capabilities. This ensures:
- ✅ Full offline functionality
- ✅ Lightning-fast responses
- ✅ Zero data sharing — your content stays on your device

**Paperly does not require internet access, user sign-in, or any cloud-based APIs.** It’s optimized for students, writers, and researchers who need speed, clarity, and privacy — all in one place.

## 🛠️ Troubleshooting

If you run into issues installing or using **Paperly**, please check the following:

- ✅ Make sure you are using **Google Chrome Dev** or **Canary**
- ✅ Your Chrome version must be **138.0.0.0 or higher**
  - You can check your version at: `chrome://settings/help`
  - [Download Chrome Dev](https://www.google.com/chrome/dev/)

- ✅ Ensure **Developer Mode** is enabled at `chrome://extensions/`
- ✅ Double-check that you've selected the correct `extension/` folder when clicking **Load unpacked**
- ✅ If the icon doesn't appear, try refreshing the browser or restarting Chrome

> 🧠 Note: Paperly relies on **Gemini Nano**, which is only supported with sufficient disk space and memory.

