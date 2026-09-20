# KX image generation skill

This package configures the native GPT `image_gen` skill to use the KX image service.

Before importing it, use KX ADM desktop settings to save the key copied from
<https://sub2api.qinjiu8.com/>. The Skill sources the OS-specific local configuration file
at runtime before every image generation call; the key is not included in this package.
