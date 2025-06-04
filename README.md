# Gemini Chat App

This is a feature-rich web-based chat application powered by the Google Gemini AI model. It provides a highly customizable and interactive chat experience, allowing users to engage with an AI, manage conversations, store memories, and integrate with various services.

## Features

*   **AI-Powered Conversations**: Engage in dynamic conversations with the Google Gemini AI model.
*   **Customizable AI Personality**: Define and adjust the AI's personality through custom prompts.
*   **Function Calling / Tool Use**: Leverage AI's ability to interact with external tools and APIs (e.g., web search, custom functions).
*   **Rich Media Support**:
    *   **File Attachments**: Send images, audio, and other files to the AI for processing.
    *   **Audio Recording**: Record and send audio messages directly within the chat.
*   **Web Search Integration**: Enable the AI to perform real-time web searches to provide up-to-date information.
*   **Conversation & Memory Management**:
    *   **Persistent Conversations**: Your chat history is saved and accessible.
    *   **AI Memories**: The AI can create, update, and delete "memories" based on your interactions, enhancing context and continuity.
    *   **Google Drive Sync**: Securely synchronize your conversations and memories with Google Drive for backup and access across devices.
*   **User Interface Customization**:
    *   **Theming**: Choose from various themes to personalize the app's appearance.
    *   **AI Avatar**: Set a custom avatar for the AI.
    *   **Code Syntax Highlighting**: Code blocks in AI responses are beautifully highlighted.
*   **Progressive Web App (PWA)**: Installable on your device, offering an app-like experience with offline capabilities and push notifications.
*   **API Key Management**: Easily configure your Google Gemini API key within the application settings.

## Technologies Used

This project is built using modern web technologies:

*   **React**: A JavaScript library for building user interfaces.
*   **TypeScript**: A typed superset of JavaScript that compiles to plain JavaScript.
*   **Vite**: A fast build tool that provides a lightning-fast development experience.
*   **Google Gemini API**: The core AI model powering the chat.
*   **Google Drive API**: For cloud synchronization of user data.
*   **IndexedDB**: For local persistent storage of application data.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   Node.js (LTS version recommended)
*   pnpm (or npm/yarn, but pnpm is used in `pnpm-lock.yaml`)
*   A Google Gemini API Key (obtainable from [Google AI Studio](https://aistudio.google.com/))
*   Google Cloud Project credentials for Google Drive API integration (if enabling sync)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [your-repo-url]
    cd [your-repo-name]
    ```
2.  **Install dependencies:**
    ```bash
    pnpm install
    # or npm install
    # or yarn install
    ```
3.  **Set up environment variables:**
    Create a `.env` file in the root directory and add your API key and other necessary configurations.
    ```env
    VITE_GEMINI_API_KEY="YOUR_GEMINI_API_KEY" # Mandatory
    VITE_GOOGLE_CLIENT_ID="995107378442-isjbskesmnmv2fcoh753brfosfv0p0ao.apps.googleusercontent.com" # Required for Google Drive Sync
    # VITE_GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY" # Required for Google Drive Sync
    # VITE_VAPID_PUBLIC_KEY="YOUR_VAPID_PUBLIC_KEY" # Optional, for push notifications
    ```
    *Replace `YOUR_GEMINI_API_KEY` with your actual API key.*
    *The `VITE_GOOGLE_CLIENT_ID` is pre-filled with the value you provided. If you plan to use Google Drive sync or push notifications, you'll need to configure the respective keys/IDs.*

### Running the Application

1.  **Start the development server:**
    ```bash
    pnpm dev
    # or npm run dev
    # or yarn dev
    ```
    The application will typically open in your browser at `http://localhost:5173` (or another port if 5173 is in use).

2.  **Build for production:**
    ```bash
    pnpm build
    # or npm run build
    # or yarn build
    ```
    This will create a `dist` folder with the production-ready build.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Your Name/Project Maintainer - [your-email@example.com]
Project Link: [https://github.com/your_username/your_repo_name](https://github.com/your_username/your_repo_name)
