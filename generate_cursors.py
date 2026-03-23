import os

svg_dir = os.path.join('frontend', 'public', 'cursors')
os.makedirs(svg_dir, exist_ok=True)

# Dark Mode Default (White arrow with dark outline/shadow) 
dark_default = '''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g filter="url(#shadow)">
    <path d="M8 5L22 19H14.5L14 19.5L10 26V5Z" fill="white" stroke="#111827" stroke-width="1.5" stroke-linejoin="round"/>
  </g>
  <defs>
    <filter id="shadow" x="4" y="2" width="24" height="30" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
    </filter>
  </defs>
</svg>'''

# Dark Mode Pointer (White hand with dark outline/shadow, or a sleek target)
dark_pointer = '''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g filter="url(#shadow)">
    <circle cx="12" cy="12" r="8" fill="white" fill-opacity="0.2" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="3" fill="white"/>
  </g>
  <defs>
    <filter id="shadow" x="0" y="0" width="24" height="24" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.4"/>
    </filter>
  </defs>
</svg>'''

# Light Mode Default (Dark arrow with light outline)
light_default = '''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g filter="url(#shadow)">
    <path d="M8 5L22 19H14.5L14 19.5L10 26V5Z" fill="#111827" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
  </g>
  <defs>
    <filter id="shadow" x="4" y="2" width="24" height="30" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.2"/>
    </filter>
  </defs>
</svg>'''

# Light Mode Pointer
light_pointer = '''<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g filter="url(#shadow)">
    <circle cx="12" cy="12" r="8" fill="#111827" fill-opacity="0.1" stroke="#111827" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="3" fill="#111827"/>
  </g>
  <defs>
    <filter id="shadow" x="0" y="0" width="24" height="24" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.2"/>
    </filter>
  </defs>
</svg>'''

open(os.path.join(svg_dir, 'dark-default.svg'), 'w').write(dark_default)
open(os.path.join(svg_dir, 'dark-pointer.svg'), 'w').write(dark_pointer)
open(os.path.join(svg_dir, 'light-default.svg'), 'w').write(light_default)
open(os.path.join(svg_dir, 'light-pointer.svg'), 'w').write(light_pointer)
print('SVGs created successfully in frontend/public/cursors/')
