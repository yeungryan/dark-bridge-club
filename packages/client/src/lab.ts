import { mount } from 'svelte';
import './app.css';
import Lab from './components/Lab.svelte';
import SweepLab from './components/SweepLab.svelte';

// lab.html: the sound check; lab.html?set=sweeps: the sweep takeovers (round 15).
const sweeps = new URLSearchParams(location.search).get('set') === 'sweeps';
export default mount(sweeps ? SweepLab : Lab, { target: document.getElementById('app')! });
