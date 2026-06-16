"""Constants for the White Noise integration."""

from __future__ import annotations

DOMAIN = "white_noise"

CONF_DEFAULT_SPEAKER = "default_speaker"
CONF_DEFAULT_DURATION = "default_duration"
CONF_MEDIA_FOLDER = "media_folder"
CONF_COPY_BUNDLED_AUDIO = "copy_bundled_audio"

DEFAULT_DURATION = 60
DEFAULT_MEDIA_FOLDER = "/media/white_noise"
DEFAULT_COPY_BUNDLED_AUDIO = True

SUPPORTED_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".flac"}
