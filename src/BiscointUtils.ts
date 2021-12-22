import Biscoint from 'biscoint-api-node';
import { Percent, Message } from './utils';
import _ from 'lodash';

const configBuy = {  apiKey: '',  apiSecret: '', };
const configSell  = {  apiKey: '',  apiSecret: '', };

const simulation = false;
const minProfitPercent = 0.01;

export class BiscointUtils {
	biscointBuy: Biscoint = <Biscoint>{};
	biscointSell: Biscoint = <Biscoint>{};
	buyOffer: Biscoint.offerResult = <Biscoint.offerResult>{};
	sellOffer: Biscoint.offerResult = <Biscoint.offerResult>{};
	balances: Biscoint.balanceResult = <Biscoint.balanceResult>{};
	profit: number = 0;
	message: Message;
	intervalSeconds = 0;
	isBRL: boolean = true;

	constructor() {
		this.message = new Message();
		try {
			this.Init();
		} catch (error: any) {
			this.message.TradeError();
			this.message.Error(JSON.stringify(error), 'Constructor');
		}
	}

	Init = async () => {
		try {
			this.CheckMissingConfig()
				.then(() => this.Connect())
				.then(() => this.Interval())
				.then(() => this.Balances())
				.then(() => this.Cycle());
		} catch (error: any) {
			this.message.TradeError();
			this.message.Error(JSON.stringify(error), 'Init');
		}
	};

	CheckMissingConfig = async () => {
		try {
			if (!configBuy.apiKey || !configSell.apiKey)
				throw new Error('Missing ApiKey');
			if (!configBuy.apiSecret || !configSell.apiSecret)
				throw new Error('Missing ApiSecret');
		} catch (error: any) {
			this.message.TradeError();
			this.message.Error(JSON.stringify(error), 'CheckMissingConfig');
		}
	};

	Connect = async () => {
		try {
			this.biscointBuy = new Biscoint({
				apiKey: configBuy.apiKey,
				apiSecret: configBuy.apiSecret,
			});
			this.biscointSell = new Biscoint({
				apiKey: configSell.apiKey,
				apiSecret: configSell.apiSecret,
			});
		} catch (error: any) {
			this.message.TradeError();
			this.message.Error(JSON.stringify(error), 'Connect');
		}
	};

	Interval = async () => {
		try {
			const { endpoints } = await this.biscointBuy.meta() as { endpoints: any };
			const { windowMs, maxRequests } = endpoints.offer.post.rateLimit;
			this.intervalSeconds = (2.0 * parseFloat(windowMs)) / parseFloat(maxRequests) / 1000.0;
			this.message.Show(`Rate limits: ${maxRequests} / ${windowMs}ms. Interval: ${this.intervalSeconds}s`);
		} catch (error: any) {
			this.message.TradeError();
			this.message.Error(JSON.stringify(error), 'Interval');
		}
	};

	Balances = async () => {
		try {
			this.balances = await this.biscointBuy.balance();
			const { BRL, BTC } = this.balances;
			this.message.Show(`Balances:  BRL: ${BRL} - BTC: ${BTC} `);
			if (Number(BRL) >= 100) this.isBRL = true;
			else this.isBRL = false;
		} catch (error: any) {
			this.message.TradeError();
			this.message.Error(JSON.stringify(error), 'Balances');
		}
	};

	Cycle = async () => {
		try {
			
			this.message.TradeCycle();
			
			let startedAt = Date.now();
			
			await this.Offer();
			
			if (!simulation && this.IsProfitable())
			{
				 await this.Trade();
				 await this.Balances();
			}

			let finishedAt = Date.now();

			setTimeout(this.Cycle, Math.max(Math.ceil(this.intervalSeconds * 1000.0 - parseFloat(String(finishedAt - startedAt))), 0));


			
		} catch (error: any) {
			this.message.TradeError();
			this.message.Error(JSON.stringify(error), 'Cycle');
		}
	};

	Trade = async () => {
		let firstLeg: Biscoint.confirmOfferResult = <Biscoint.confirmOfferResult>{};
		let secondLeg: Biscoint.confirmOfferResult = <Biscoint.confirmOfferResult>{};

		try {
			const firstOffer = this.isBRL ? this.buyOffer : this.sellOffer;
			const secondOffer = this.isBRL ? this.sellOffer : this.buyOffer;

			const startedAt = Date.now();
				
			firstLeg = await this.biscointBuy.confirmOffer({offerId: firstOffer.offerId});
			secondLeg = await this.biscointBuy.confirmOffer({offerId: secondOffer.offerId});

			const finishedAt = Date.now();

			this.message.TradeProfit();
			this.message.Show(`${this.message.CountersText()} Success, ${this.message.ProfitText(this.profit)}% ${this.message.DiffTimeText(startedAt, finishedAt)}`);
		} catch (error: any) {
			this.message.TradeError();
			this.message.Error(JSON.stringify(error), 'Confirm offer');

			if (firstLeg && !secondLeg) {
				await this.ExecuteSecondLeg();
			}
		}
	};

	Offer = async () => {
		try {
			const { BRL, BTC } = this.balances;
			let offerAmount = this.isBRL ? BRL : BTC;
			const promiseBuy = this.biscointBuy.offer({amount: offerAmount, isQuote: this.isBRL, op: 'buy'});
			const promiseSell = this.biscointSell.offer({amount: offerAmount, isQuote: this.isBRL, op: 'sell'});

			const startedAt = Date.now();

			await Promise.all([promiseBuy, promiseSell]).then(offers => {
				const finishedAt = Date.now();
				this.buyOffer = offers[0];
				this.sellOffer = offers[1];
				this.profit = Percent(Number(offers[0].efPrice), Number(offers[1].efPrice));
				this.message.Show(`${this.message.CountersText()} ${this.message.BuyText(offers[0])} ${this.message.SellText(offers[1])} ${this.message.ProfitText(this.profit)} ${this.message.DiffTimeText(startedAt, finishedAt)}`);
			}).catch(error => {
					this.message.TradeError();
					this.message.Error(JSON.stringify(error), 'Offer > Promise.all');
			});

		} catch (error: any) {
			this.message.TradeError();
			this.message.Error(JSON.stringify(error), 'Offer');
		}
	};

	Offer50 = async () => {
		try {
			let offerAmount: string = "50.00";
			const promiseBuy = this.biscointBuy.offer({amount: offerAmount, isQuote: this.isBRL, op: 'buy'});
			const promiseSell = this.biscointSell.offer({amount: offerAmount, isQuote: this.isBRL, op: 'sell'});

			const startedAt = Date.now();

			await Promise.all([promiseBuy, promiseSell]).then(offers => {
				const finishedAt = Date.now();
				this.buyOffer = offers[0];
				this.sellOffer = offers[1];
				this.profit = Percent(Number(offers[0].efPrice), Number(offers[1].efPrice));
				this.message.Show(`${this.message.CountersText()} ${this.message.BuyText(offers[0])} ${this.message.SellText(offers[1])} ${this.message.ProfitText(this.profit)} ${this.message.DiffTimeText(startedAt, finishedAt)} [Offer50]`);
			}).catch(error => {
					this.message.TradeError();
					this.message.Error(JSON.stringify(error), 'Offer > Promise.all');
			});

		} catch (error: any) {
			this.message.TradeError();
			this.message.Error(JSON.stringify(error), 'Offer');
		}
	};

	ExecuteSecondLeg = async () => {
		try {
			let secondOp: Biscoint.op = this.isBRL ? 'sell' : 'buy';
			let secondOffer: Biscoint.offerResult = this.isBRL ? this.sellOffer : this.buyOffer;
			const trades: any = await this.biscointBuy.trades({ op: secondOp });
			if (_.find(trades, t => t.offerId === secondOffer.offerId)) {
				this.message.Show(`${this.message.CountersText()} The second leg executed.`);
			} else {
				this.message.TradeLose();
				this.isBRL = !this.isBRL;
				this.message.Show(`${this.message.CountersText()} Only the firstleg was executed.`);
			}
		} catch (error: any) {
			this.message.TradeError();
			this.message.Error(JSON.stringify(error), 'ExecuteSecondLeg');
		}
	};

	IsProfitable = () => this.profit >= minProfitPercent;
}
