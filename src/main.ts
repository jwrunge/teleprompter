import { mount } from 'svelte'

// Shoelace (Web Components)
import '@shoelace-style/shoelace/dist/themes/dark.css'
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js'
import '@shoelace-style/shoelace/dist/components/icon/icon.js'
import '@shoelace-style/shoelace/dist/components/input/input.js'

// Needed for things like <sl-icon>. You can switch this to a local path later for offline builds.
setBasePath('https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.20.1/dist/')

import './app.css'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
