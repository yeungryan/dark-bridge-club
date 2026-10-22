import { mount } from 'svelte';
import './app.css';
import AttackLab from './components/AttackLab.svelte';
import FxLab from './components/FxLab.svelte';

const attack = new URLSearchParams(location.search).get('set') === 'attack';
export default mount(attack ? AttackLab : FxLab, { target: document.getElementById('app')! });
