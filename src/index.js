import { app } from '@azure/functions';
import './functions/keepAlive.js'; 

app.setup({
    enableHttpStream: true,
});