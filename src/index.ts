import { Message } from './utils';
import { BiscointUtils } from './BiscointUtils';

let message: Message;

async function start() {
	message = new Message();
	new BiscointUtils();
}

start().catch(error => message.Error(error, `index.ts > start`));
