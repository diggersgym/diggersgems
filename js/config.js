// ─────────────────────────────────────────────
//  CloudPlay — Configuration
//  Fill in your credentials from Google Cloud Console
// ─────────────────────────────────────────────

const CONFIG = {
  // Get these from: https://console.cloud.google.com
  // See SETUP.md for step-by-step instructions

  CLIENT_ID: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com',
  API_KEY: 'https://diggersgym.github.io',

  // The Google Drive folder ID to scan for media
  // Leave empty to scan your entire Drive (slower)
  // Or paste the ID from a folder URL: drive.google.com/drive/folders/THIS_PART
  ROOT_FOLDER_ID: '',

  // App name shown in the UI 
  APP_NAME: 'Digger´s Gems',

  // Supported file types
  AUDIO_TYPES: ['mp3', 'aac', 'm4a', 'wav', 'flac', 'aiff', 'ogg', 'opus', 'wma'],
  VIDEO_TYPES: ['mp4', 'm4v', 'mov', 'webm'],
};
