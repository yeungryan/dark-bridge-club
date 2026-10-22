import { mount } from 'svelte';
import './app.css';
import AttackLab from './components/AttackLab.svelte';
import FxLab from './components/FxLab.svelte';

// The attack mockups: batch 1 (?set=attack) and batch 2 (?set=lightning, sound, ice, metal).
const set = new URLSearchParams(location.search).get('set') ?? '';
const attack = ['attack', 'picks', 'finish1', 'finish2', 'lightning', 'sound', 'ice', 'metal'].includes(set);
export default mount(attack ? AttackLab : FxLab, { target: document.getElementById('app')! });
