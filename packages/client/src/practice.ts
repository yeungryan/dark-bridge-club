import { mount } from 'svelte';
import './app.css';
import Practice from './components/Practice.svelte';

export default mount(Practice, { target: document.getElementById('app')! });
