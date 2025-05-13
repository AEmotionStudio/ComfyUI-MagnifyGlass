# Define the web directory for our extension
WEB_DIRECTORY = "./web"

# Required to register as a ComfyUI extension
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

# List of JS files to be loaded
__js_files__ = ["magnify_glass.js"]

# List of exported elements
__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY', '__js_files__']

# Print a message to confirm the extension loaded
print("ComfyUI Magnify Glass extension loaded")