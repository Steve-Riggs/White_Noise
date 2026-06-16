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
- Setup only asks for the media folder and whether bundled audio should be copied

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

The setup screen does not ask for speaker, duration or volume. Those belong in the card, action, script or automation that starts playback.

## White Noise card

The integration includes a Lovelace card:

```text
/white_noise/white-noise-card.js
```

Add it as a dashboard resource, then use:

```yaml
type: custom:white-noise-card
entity: sensor.white_noise_sounds
title: Nursery White Noise
default_speaker: media_player.nursery_speaker
default_duration: 60
default_volume: 20
accent_color: "#f5a623"
show_browser_preview: true
speakers:
  - entity: media_player.nursery_speaker
    name: Nursery
  - entity: media_player.bedroom_speaker
    name: Bedroom
durations:
  - label: 15m
    minutes: 15
  - label: 30m
    minutes: 30
  - label: 1h
    minutes: 60
  - label: 2h
    minutes: 120
```

### Compact screen example

For a small panel such as a Sonoff NSPanel Pro Gen2, use one pinned speaker, fewer duration buttons and compact mode:

```yaml
type: custom:white-noise-card
entity: sensor.white_noise_sounds
title: Nursery
compact_mode: true
default_speaker: media_player.nursery_speaker
default_duration: 30
default_volume: 18
accent_color: "#f5a623"
show_browser_preview: false
speakers:
  - entity: media_player.nursery_speaker
    name: Nursery
durations:
  - label: 15m
    minutes: 15
  - label: 30m
    minutes: 30
  - label: 1h
    minutes: 60
  - label: ∞
    minutes: 0
```

## Browser test card

The integration includes a tiny browser-only test card. This is only for testing whether the discovered files can play in your current browser window.

Add this Lovelace resource:

```text
/white_noise/browser-test-card.js
```

Then add this card:

```yaml
type: custom:white-noise-browser-test-card
entity: sensor.white_noise_sounds
```

This does not play on a Home Assistant speaker. It plays in the browser tab/device viewing the dashboard.

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
