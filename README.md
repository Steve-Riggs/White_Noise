# White Noise for Home Assistant

A small Home Assistant custom integration and Lovelace card for local white-noise audio.

## What it does

- Creates `sensor.white_noise_sounds`
- Scans `/media/white_noise` for audio files
- Cleans filenames into friendly names
- Adds actions:
  - `white_noise.play`
  - `white_noise.stop`
  - `white_noise.refresh_sounds`
- Includes `custom:white-noise-card`
- Supports playback from the dashboard device/browser or a selected `media_player`

## Audio files

Place audio files in:

```text
/media/white_noise
```

Supported formats:

```text
.mp3, .wav, .ogg, .m4a, .flac
```

Then run:

```yaml
action: white_noise.refresh_sounds
```

You can also bundle personal audio files in:

```text
custom_components/white_noise/audio
```

The integration copies bundled audio into `/media/white_noise` on startup. Existing files are not overwritten.

## Dashboard Resource

Add this as a JavaScript module resource:

```text
/white_noise/white-noise-card.js?v=0.7.0
```

## Card Example

```yaml
type: custom:white-noise-card
entity: sensor.white_noise_sounds
show_title: false
default_play_target: this_device
default_speaker: media_player.nursery_speaker
default_duration: 30
default_volume: 25
accent_color: "#f5a623"
background_color: "#3b285d"
background_opacity: 72
control_opacity: 92
allow_this_device: true
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
```

If `durations: []`, no timer buttons are shown and `default_duration` is used.

## Small Screen Example

```yaml
type: custom:white-noise-card
entity: sensor.white_noise_sounds
show_title: false
compact_mode: true
default_play_target: this_device
default_speaker: media_player.nursery_speaker
default_duration: 30
default_volume: 18
accent_color: "#f5a623"
background_color: "#3b285d"
background_opacity: 80
control_opacity: 94
allow_this_device: true
speakers:
  - entity: media_player.nursery_speaker
    name: Nursery
durations:
  - label: 15m
    minutes: 15
  - label: 30m
    minutes: 30
```

## Visual Editor

The card includes a visual editor for:

- heading visibility
- accent colour
- background colour
- background opacity
- control opacity
- default playback target
- default speaker from Home Assistant media-player entities
- compact mode
- available speakers
- timer buttons
