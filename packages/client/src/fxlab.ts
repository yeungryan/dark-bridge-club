import { mount } from 'svelte';
import './app.css';
import FxLab from './components/FxLab.svelte';

export default mount(FxLab, { target: document.getElementById('app')! });
