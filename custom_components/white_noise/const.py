"""Constants for the White Noise integration."""
from __future__ import annotations

DOMAIN = "white_noise"
NAME = "White Noise"
VERSION = "0.1.0"

PLATFORMS = ["sensor"]

CONF_DEFAULT_SPEAKER = "default_speaker"
CONF_DEFAULT_DURATION = "default_duration"
CONF_DEFAULT_VOLUME = "default_volume"
CONF_MEDIA_FOLDER = "media_folder"
CONF_COPY_BUNDLED_AUDIO = "copy_bundled_audio"

DEFAULT_DURATION_MINUTES = 60
DEFAULT_VOLUME_PERCENT = 30
DEFAULT_MEDIA_SUBFOLDER = "white_noise"
DEFAULT_COPY_BUNDLED_AUDIO = True

SUPPORTED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"}

SERVICE_PLAY = "play"
SERVICE_STOP = "stop"
SERVICE_REFRESH = "refresh_sounds"

ATTR_SOUNDS = "sounds"
ATTR_SOUND_COUNT = "sound_count"
ATTR_MEDIA_FOLDER = "media_folder"
ATTR_DEFAULT_SPEAKER = "default_speaker"
ATTR_DEFAULT_DURATION = "default_duration"
ATTR_DEFAULT_VOLUME = "default_volume"
ATTR_LAST_SOUND = "last_sound"
ATTR_LAST_SPEAKER = "last_speaker"
ATTR_LAST_STARTED = "last_started"
