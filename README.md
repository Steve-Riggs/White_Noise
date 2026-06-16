# White Noise for Home Assistant

A personal Home Assistant backend integration for playing bundled or local white noise files on any `media_player` entity.

This first version creates a sensor entity and three services:

- `sensor.white_noise_sounds` — exposes discovered audio files as entity attributes
- `white_noise.play` — plays a selected sound on a selected speaker
- `white_noise.stop` — stops a selected speaker and cancels any active stop timer
- `white_noise.refresh_sounds` — re-scans the media folder

## Audio files

The integration is designed to use Home Assistant's media folder:

```text
/media/white_noise
```

Because this is for personal use, you can also bundle audio files directly in the repo here:

```text
custom_components/white_noise/audio/
```

On startup, the integration copies supported files from the bundled audio folder into `/media/white_noise`. Existing files are not overwritten.

Supported formats:

- `.mp3`
- `.wav`
- `.ogg`
- `.m4a`
- `.flac`
- `.aac`

A tiny generated `sample-white-noise.wav` file is included so you can test the integration immediately.

## Clean file names

File names are cleaned for the entity attributes.

Examples:

```text
pink_noise.mp3      -> Pink Noise
womb-sounds.mp3     -> Womb Sounds
rain storm.m4a      -> Rain Storm
```

The generated sound IDs are stable and automation-friendly:

```text
pink_noise.mp3      -> pink_noise
womb-sounds.mp3     -> womb_sounds
```

## Installation using HACS custom repository

1. Push this folder to your GitHub repository.
2. In Home Assistant, open HACS.
3. Add your GitHub repo as a custom repository.
4. Choose repository type: **Integration**.
5. Install the integration.
6. Restart Home Assistant.
7. Go to **Settings > Devices & services > Add integration**.
8. Search for **White Noise**.

## Manual installation

Copy this folder:

```text
custom_components/white_noise
```

into your Home Assistant config folder:

```text
/config/custom_components/white_noise
```

Then restart Home Assistant and add the integration from **Settings > Devices & services**.

## Configuration options

During setup, you can choose:

- default speaker
- default duration
- default volume
- media folder
- whether bundled audio files should be copied into the media folder

Defaults:

```text
Default media folder: /media/white_noise
Default duration:     60 minutes
Default volume:       30%
Copy bundled audio:   enabled
```

## Example service call

```yaml
service: white_noise.play
data:
  speaker: media_player.nursery_speaker
  sound: sample_white_noise
  duration: 60
  volume: 25
```

You can also omit `speaker` if you configured a default speaker.

```yaml
service: white_noise.play
data:
  sound: sample_white_noise
  duration: 30
```

## Stop playback

```yaml
service: white_noise.stop
data:
  speaker: media_player.nursery_speaker
```

## Refresh sounds

Use this after adding or removing files from `/media/white_noise`:

```yaml
service: white_noise.refresh_sounds
```

## Entity attributes

The sensor exposes the discovered files in its attributes:

```yaml
sounds:
  - id: sample_white_noise
    name: Sample White Noise
    filename: sample-white-noise.wav
    media_content_id: media-source://media_source/local/white_noise/sample-white-noise.wav
sound_count: 1
media_folder: /media/white_noise
default_speaker: media_player.nursery_speaker
default_duration: 60
default_volume: 30
```

This is intended to make a future Lovelace card easy: the card can read `sensor.white_noise_sounds` and build a dropdown from the `sounds` attribute.

## Suggested dashboard button

```yaml
type: button
name: Play White Noise
icon: mdi:speaker-wireless
tap_action:
  action: call-service
  service: white_noise.play
  data:
    sound: sample_white_noise
    duration: 60
```

## Notes

This is a starter integration aimed at personal use. It deliberately keeps the logic simple and local:

- no cloud service
- no external Python dependencies
- no audio downloads
- no frontend card yet

A future version could add a Lovelace card, a proper dropdown editor, and per-room presets.
