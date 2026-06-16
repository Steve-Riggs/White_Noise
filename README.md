# White Noise for Home Assistant

A small personal Home Assistant custom integration for playing white noise files from the Home Assistant media folder.

## What it does

- Creates `sensor.white_noise_sounds`
- Scans `/media/white_noise` for audio files
- Cleans filenames into friendly names
- Adds actions:
  - `white_noise.play`
  - `white_noise.stop`
  - `white_noise.refresh_sounds`
- Supports per-room playback by passing speaker, duration and volume in each action
- Uses setup values only as fallbacks

## Audio files

Place audio files in:

```text
/media/white_noise
```

Supported formats:

```text
.mp3, .wav, .ogg, .m4a, .flac
```

You can also bundle personal audio files in:

```text
custom_components/white_noise/audio
```

When `Copy bundled audio files into the media folder` is enabled, the integration copies those files into `/media/white_noise` on startup. Existing files are not overwritten.

## Filename cleanup

Examples:

```text
womb-sounds.mp3 -> Womb Sounds
pink_noise.mp3 -> Pink Noise
```

The action uses IDs:

```text
womb_sounds
pink_noise
```

Check `sensor.white_noise_sounds` for the exact IDs.

## Example actions

Nursery:

```yaml
action: white_noise.play
data:
  speaker: media_player.nursery_speaker
  sound: pink_noise
  duration: 60
  volume: 18
```

Bedroom:

```yaml
action: white_noise.play
data:
  speaker: media_player.bedroom_speaker
  sound: rain
  duration: 30
  volume: 25
```

Stop a room:

```yaml
action: white_noise.stop
data:
  speaker: media_player.nursery_speaker
```

Refresh sounds:

```yaml
action: white_noise.refresh_sounds
```

## Multiple rooms

Use one integration instance and create multiple cards, buttons, scripts or automations.

Each one can pass its own:

- `speaker`
- `sound`
- `duration`
- `volume`

The setup screen defaults are just fallbacks for quick testing or simple one-room setups.

## Install manually

Copy this folder:

```text
custom_components/white_noise
```

to:

```text
/config/custom_components/white_noise
```

Restart Home Assistant, then add **White Noise** from **Settings > Devices & services**.

## HACS custom repository

Add the GitHub repo as a custom HACS repository with type **Integration**.
