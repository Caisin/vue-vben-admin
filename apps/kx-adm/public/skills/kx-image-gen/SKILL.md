---
name: kx-image-gen
description: Use the native GPT image_gen skill with the KX image service configuration.
---

# KX image generation

Use the native GPT `image_gen` skill for every image generation or image editing request.
Keep the native image_gen workflow, prompt handling, safety behavior, and output handling.
This skill only supplies the connection configuration below; it is not a replacement image
generation API or a custom image generation implementation.

## Required initialization

Before every `image_gen` call, run the following initialization in the same shell/process
that will invoke the image tool. Do not skip this step and do not rely on a previously
loaded environment.

1. Determine the host operating system.
2. Source the matching KX ADM configuration file:

   - macOS: `set -a; source "$HOME/.config/kx-adm/image-gen.env"; set +a`
   - Windows PowerShell: `. "$env:APPDATA/kx-adm/image-gen.ps1"`

3. Verify that `IMG_OPEN_AI_KEY` is present and not empty.
4. Only after the verification succeeds, configure and call the native `image_gen` skill.

If sourcing fails or the variable is empty, stop before calling `image_gen`. Tell the user
to copy a key from `https://sub2api.qinjiu8.com/` and save it through KX ADM's desktop
settings, then retry.

## Connection configuration

- `base_url`: `https://sub2api.qinjiu8.com/`
- `api_key`: `process.env.IMG_OPEN_AI_KEY`

The native image tool must receive `process.env.IMG_OPEN_AI_KEY` from that initialization
and use `https://sub2api.qinjiu8.com/` as its base URL.

Never ask the user to paste the key into chat. Never put the key in a prompt, skill archive,
log, generated artifact, or response. Do not return or display the key.
