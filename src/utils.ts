import Biscoint from "biscoint-api-node";

const fs = require('fs');

export function Percent(value1: number, value2: number) {
	return (Number(value2) / Number(value1) - 1) * 100;
}

export class Message {
	tradeCycleCount: number = 0;
	tradeProfitCount: number = 0;
	tradeLoseCount: number = 0;
	tradeErrorCount: number = 0;

	Show(message: string, level: string = 'info') {
		console.log(`${new Date().toISOString()} [${level}] - ${message}`);
	}

	Error(message: string, where: string) {
		var fullMessage = `${where}: ` + JSON.stringify(message);
		console.log(`${new Date().toISOString()} [Error] - ${fullMessage}`);
		this.SaveError(fullMessage);
	}

	TradeCycle = () => (this.tradeCycleCount += 1);
	TradeProfit = () => (this.tradeProfitCount += 1);
	TradeLose = () => (this.tradeLoseCount += 1);
	TradeError = () => (this.tradeErrorCount += 1);
	CountersText = () => {
		return `[C${this.tradeCycleCount}|P${this.tradeProfitCount}|L${this.tradeLoseCount}|E${this.tradeErrorCount}]`;
	};

	DiffTimeText = (startedAt: number, finishedAt: number) => {
		return `(${finishedAt - startedAt} ms)`;
	};

	ProfitText = (profit: number) => {
		return `Profit: ${profit.toFixed(3)}%`;
	};

	BuyText = (buyOffer: Biscoint.offerResult) => {
		return `Buy: ${buyOffer.efPrice}`;
	};

	SellText = (sellOffer: Biscoint.offerResult) => {
		return `Sell: ${sellOffer.efPrice}`;
	};

	SaveError = (error: string) => {
		var _ = new Date();
		fs.writeFile(
			__dirname +
				`/errors/error_${_.getDate()}_${_.getMonth()}_${_.getFullYear()}_${_.getHours()}_${_.getMinutes()}_${_.getMilliseconds()}.log`,
			error,
			function (err: any) {
				if (err) return console.log(err);
			},
		);
	};
}
