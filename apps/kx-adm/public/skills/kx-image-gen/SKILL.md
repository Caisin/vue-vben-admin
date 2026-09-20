---
name: kx-image-gen
description: Use the native GPT image_gen skill with the KX image service configuration.
---

# KX image generation

Use the native GPT `image_gen` skill for every image generation or image editing request.
Keep the native image_gen workflow, prompt handling, safety behavior, and output handling.
This skill only supplies the connection configuration below; it is not a replacement image
generation API or a custom image generation implementation.

## Connection configuration

- `base_url`: `https://sub2api.qinjiu8.com/`
- `api_key`: `process.env.IMG_OPEN_AI_KEY`

Before calling `image_gen`, verify that `process.env.IMG_OPEN_AI_KEY` is present and not
empty. If it is unavailable, tell the user to copy a key from
`https://sub2api.qinjiu8.com/`, set the local environment variable `IMG_OPEN_AI_KEY`, and
restart the computer before trying again.

Never ask the user to paste the key into chat. Never put the key in a prompt, source file,
skill archive, log, generated artifact, or response. Do not return or display the key.
