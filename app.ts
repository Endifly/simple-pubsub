// interfaces
interface IEvent {
  type(): EnumEvent;
  machineId(): string;
}

type ILazyFireEvent = (event: IEvent) => void;

interface ISubscriber {
  handle(event: IEvent, lazyFire?: ILazyFireEvent): void;
}

interface IPublishSubscribeService {
  publish(event: IEvent): void;
  subscribe(type: EnumEvent, handler: ISubscriber): void;
  // unsubscribe ( /* Question 2 - build this feature */ );
  unsubscribe(handler: ISubscriber): void;
}

type EnumEvent = "sale" | "refill" | "stock_low" | "stock_ok";

// implementations
class MachineSaleEvent implements IEvent {
  constructor(
    private readonly _sold: number,
    private readonly _machineId: string
  ) {}

  machineId(): string {
    return this._machineId;
  }

  getSoldQuantity(): number {
    return this._sold;
  }

  type(): EnumEvent {
    return "sale";
  }
}

class MachineRefillEvent implements IEvent {
  constructor(
    private readonly _refill: number,
    private readonly _machineId: string
  ) {}

  machineId(): string {
    return this._machineId;
  }

  getRefillQuantity(): number {
    return this._refill;
  }

  type(): EnumEvent {
    return "refill";
  }
}

class LowStockWarningEvent implements IEvent {
  constructor(private readonly _machineId: string) {}

  type(): EnumEvent {
    return "stock_low";
  }
  machineId(): string {
    return this._machineId;
  }
}

class StockLevelOkEvent implements IEvent {
  constructor(private readonly _machineId: string) {}

  type(): EnumEvent {
    return "stock_ok";
  }
  machineId(): string {
    return this._machineId;
  }
}

class MachineStockWarningSubscriber implements ISubscriber {
  public machines: Machine[];

  constructor(machines: Machine[]) {
    this.machines = machines;
  }

  handle(event: LowStockWarningEvent): void {
    console.log("LowStockWarningEvent fired to machine : ", event.machineId());
  }
}

class MachineStockOkSubscriber implements ISubscriber {
  public machines: Machine[];

  constructor(machines: Machine[]) {
    this.machines = machines;
  }

  handle(event: StockLevelOkEvent): void {
    console.log("StockLevelOkEvent fired to machine : ", event.machineId());
  }
}

class MachineSaleSubscriber implements ISubscriber {
  public machines: Machine[];

  constructor(machines: Machine[]) {
    this.machines = machines;
  }

  handle(event: MachineSaleEvent, lazyFire: ILazyFireEvent): void {
    // this.machines[2].stockLevel -= event.getSoldQuantity();
    this.machines.forEach((machine) => {
      if (machine.id === event.machineId()) {
        const isLowStock = machine.sale(event.getSoldQuantity());

        if (isLowStock) lazyFire(new LowStockWarningEvent(machine.id));
      }
    });
  }
}

class MachineRefillSubscriber implements ISubscriber {
  public machines: Machine[];

  constructor(machines: Machine[]) {
    this.machines = machines;
  }

  handle(event: MachineRefillEvent, lazyFire: ILazyFireEvent): void {
    this.machines.forEach((machine) => {
      if (machine.id === event.machineId()) {
        const isRefilled = machine.refill(event.getRefillQuantity());

        if (isRefilled) lazyFire(new StockLevelOkEvent(machine.id));
      }
    });
  }
}

// objects
class Machine {
  public stockLevel = 10;
  public id: string;

  constructor(id: string) {
    this.id = id;
  }

  sale(saleAmount: number): boolean {
    if (saleAmount < 0) throw Error("sale amount should be alteast 0");
    let prev = this.stockLevel;
    this.stockLevel = Math.max(0, this.stockLevel - saleAmount);

    if (prev >= 3 && this.stockLevel < 3) return true;
    return false;
  }

  refill(refillAmount: number) {
    if (refillAmount < 0) throw Error("refill amount should be atleast 0");
    let prev = this.stockLevel;
    this.stockLevel += refillAmount;

    if (prev < 3 && this.stockLevel >= 3) return true;
    return false;
  }
}

type ICallbackPool = {
  [type in EnumEvent]?: Set<ISubscriber>;
};

class PublishSubscribeService implements IPublishSubscribeService {
  public pool: ICallbackPool;
  private eventQueue: IEvent[];

  constructor() {
    this.pool = {};
    this.eventQueue = [];
  }

  private getCallbackPool(type: EnumEvent): Set<ISubscriber> {
    const isTypeNotExist = !(type in this.pool);

    if (isTypeNotExist) this.pool[type] = new Set();

    return this.pool[type] as Set<ISubscriber>;
  }

  private addEvent(event: IEvent): void {
    this.eventQueue.push(event);
  }

  private executeEvent(): void {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();

      if (!event) continue;

      this.getCallbackPool(event.type()).forEach((handler) => {
        handler.handle(event, this.addEvent.bind(this));
      });
    }
  }

  publish(event: IEvent): void {
    this.addEvent(event);
    this.executeEvent();
  }

  subscribe(type: EnumEvent, handler: ISubscriber): void {
    if (type === "refill" && !(handler instanceof MachineRefillSubscriber)) {
      throw Error("Invalid subscribe instant");
    }
    if (type === "sale" && !(handler instanceof MachineSaleSubscriber)) {
      throw Error("Invalid subscribe instant");
    }
    if (
      type === "stock_low" &&
      !(handler instanceof MachineStockWarningSubscriber)
    ) {
      throw Error("Invalid subscribe instant");
    }
    if (type === "stock_ok" && !(handler instanceof MachineStockOkSubscriber)) {
      throw Error("Invalid subscribe instant");
    }

    this.getCallbackPool(type).add(handler);
  }

  unsubscribe(handler: ISubscriber): void {
    Object.keys(this.pool).forEach((keyPool) => {
      this.pool[keyPool as EnumEvent]?.delete(handler);
    });
  }
}

// helpers
const randomMachine = (): string => {
  const random = Math.random() * 3;
  if (random < 1) {
    return "001";
  } else if (random < 2) {
    return "002";
  }
  return "003";
};

const eventGenerator = (): IEvent => {
  const random = Math.random();
  if (random < 0.5) {
    const saleQty = Math.random() < 0.5 ? 1 : 2; // 1 or 2
    return new MachineSaleEvent(saleQty, randomMachine());
  }
  const refillQty = Math.random() < 0.5 ? 3 : 5; // 3 or 5
  return new MachineRefillEvent(refillQty, randomMachine());
};

const title = (title: string) => console.log(`${title}\n`);

// program
const case1 = async () => {
  title("normal case");
  const machines: Machine[] = [
    new Machine("001"),
    new Machine("002"),
    new Machine("003"),
  ];

  const saleSubscriber = new MachineSaleSubscriber(machines);
  const refillSubscriber = new MachineRefillSubscriber(machines);
  const stockWarningSubscriber = new MachineStockWarningSubscriber(machines);
  const stockOkSubscriber1 = new MachineStockOkSubscriber(machines);

  const pubSubService: IPublishSubscribeService = new PublishSubscribeService();
  pubSubService.subscribe("sale", saleSubscriber);
  pubSubService.subscribe("refill", refillSubscriber);
  pubSubService.subscribe("stock_low", stockWarningSubscriber);
  pubSubService.subscribe("stock_ok", stockOkSubscriber1);

  pubSubService.publish(new MachineSaleEvent(8, "002"));
  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "002"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));

  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));
  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));
};

const case2 = async () => {
  title("duplicate sub with same subscriber, it should not run twice");
  const machines: Machine[] = [
    new Machine("001"),
    new Machine("002"),
    new Machine("003"),
  ];

  const saleSubscriber = new MachineSaleSubscriber(machines);
  const refillSubscriber = new MachineRefillSubscriber(machines);
  const stockWarningSubscriber = new MachineStockWarningSubscriber(machines);
  const stockOkSubscriber1 = new MachineStockOkSubscriber(machines);

  const pubSubService: IPublishSubscribeService = new PublishSubscribeService();
  pubSubService.subscribe("sale", saleSubscriber);
  pubSubService.subscribe("refill", refillSubscriber);
  pubSubService.subscribe("stock_low", stockWarningSubscriber);
  pubSubService.subscribe("stock_ok", stockOkSubscriber1);
  pubSubService.subscribe("stock_ok", stockOkSubscriber1);

  pubSubService.publish(new MachineSaleEvent(8, "002"));
  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "002"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));

  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));
  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));
};

const case3 = async () => {
  title("unsub stock_ok since start");
  const machines: Machine[] = [
    new Machine("001"),
    new Machine("002"),
    new Machine("003"),
  ];

  const saleSubscriber = new MachineSaleSubscriber(machines);
  const refillSubscriber = new MachineRefillSubscriber(machines);
  const stockWarningSubscriber = new MachineStockWarningSubscriber(machines);
  const stockOkSubscriber1 = new MachineStockOkSubscriber(machines);

  const pubSubService: IPublishSubscribeService = new PublishSubscribeService();
  pubSubService.subscribe("sale", saleSubscriber);
  pubSubService.subscribe("refill", refillSubscriber);
  pubSubService.subscribe("stock_low", stockWarningSubscriber);
  pubSubService.subscribe("stock_ok", stockOkSubscriber1);
  pubSubService.unsubscribe(stockOkSubscriber1);

  pubSubService.publish(new MachineSaleEvent(8, "002"));
  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "002"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));

  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));
  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));
};

const case4 = async () => {
  title("unsub stock_ok while publishing");

  const machines: Machine[] = [
    new Machine("001"),
    new Machine("002"),
    new Machine("003"),
  ];

  const saleSubscriber = new MachineSaleSubscriber(machines);
  const refillSubscriber = new MachineRefillSubscriber(machines);
  const stockWarningSubscriber = new MachineStockWarningSubscriber(machines);
  const stockOkSubscriber1 = new MachineStockOkSubscriber(machines);

  const pubSubService: IPublishSubscribeService = new PublishSubscribeService();
  pubSubService.subscribe("sale", saleSubscriber);
  pubSubService.subscribe("refill", refillSubscriber);
  pubSubService.subscribe("stock_low", stockWarningSubscriber);
  pubSubService.subscribe("stock_ok", stockOkSubscriber1);

  pubSubService.publish(new MachineSaleEvent(8, "002"));
  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "002"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));

  pubSubService.unsubscribe(stockOkSubscriber1);

  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));
  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));
};

const case5 = async () => {
  title("unsub refill, machine should not be able to refill");

  const machines: Machine[] = [
    new Machine("001"),
    new Machine("002"),
    new Machine("003"),
  ];

  const saleSubscriber = new MachineSaleSubscriber(machines);
  const refillSubscriber = new MachineRefillSubscriber(machines);
  const stockWarningSubscriber = new MachineStockWarningSubscriber(machines);
  const stockOkSubscriber1 = new MachineStockOkSubscriber(machines);

  const pubSubService: IPublishSubscribeService = new PublishSubscribeService();
  pubSubService.subscribe("sale", saleSubscriber);
  pubSubService.subscribe("refill", refillSubscriber);
  pubSubService.subscribe("stock_low", stockWarningSubscriber);
  pubSubService.subscribe("stock_ok", stockOkSubscriber1);
  pubSubService.unsubscribe(refillSubscriber);

  pubSubService.publish(new MachineSaleEvent(8, "002"));
  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "002"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));

  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));
  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));
};

const case6 = async () => {
  title(
    "unsub refill while publishing, machine should be able to refill only 1 time"
  );

  const machines: Machine[] = [
    new Machine("001"),
    new Machine("002"),
    new Machine("003"),
  ];

  const saleSubscriber = new MachineSaleSubscriber(machines);
  const refillSubscriber = new MachineRefillSubscriber(machines);
  const stockWarningSubscriber = new MachineStockWarningSubscriber(machines);
  const stockOkSubscriber1 = new MachineStockOkSubscriber(machines);

  const pubSubService: IPublishSubscribeService = new PublishSubscribeService();
  pubSubService.subscribe("sale", saleSubscriber);
  pubSubService.subscribe("refill", refillSubscriber);
  pubSubService.subscribe("stock_low", stockWarningSubscriber);
  pubSubService.subscribe("stock_ok", stockOkSubscriber1);

  pubSubService.publish(new MachineSaleEvent(8, "002"));
  pubSubService.publish(new MachineSaleEvent(8, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "002"));
  pubSubService.unsubscribe(refillSubscriber);
  pubSubService.publish(new MachineRefillEvent(5, "003"));

  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));
  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));
};

const case7 = async () => {
  title("sub refill while publishing");

  const machines: Machine[] = [
    new Machine("001"),
    new Machine("002"),
    new Machine("003"),
  ];

  const saleSubscriber = new MachineSaleSubscriber(machines);
  const refillSubscriber = new MachineRefillSubscriber(machines);
  const stockWarningSubscriber = new MachineStockWarningSubscriber(machines);
  const stockOkSubscriber1 = new MachineStockOkSubscriber(machines);

  const pubSubService: IPublishSubscribeService = new PublishSubscribeService();
  pubSubService.subscribe("sale", saleSubscriber);
  pubSubService.subscribe("stock_low", stockWarningSubscriber);
  pubSubService.subscribe("stock_ok", stockOkSubscriber1);

  pubSubService.publish(new MachineSaleEvent(8, "002"));
  pubSubService.publish(new MachineSaleEvent(8, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "002"));
  pubSubService.subscribe("refill", refillSubscriber);
  pubSubService.publish(new MachineRefillEvent(5, "003"));

  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));
  pubSubService.publish(new MachineSaleEvent(7, "003"));
  pubSubService.publish(new MachineRefillEvent(5, "003"));
};

const case8 = async () => {
  title("unsub");

  const machines: Machine[] = [
    new Machine("001"),
    new Machine("002"),
    new Machine("003"),
  ];

  const saleSubscriber = new MachineSaleSubscriber(machines);
  const refillSubscriber = new MachineRefillSubscriber(machines);
  const stockWarningSubscriber = new MachineStockWarningSubscriber(machines);
  const stockOkSubscriber1 = new MachineStockOkSubscriber(machines);

  const pubSubService: IPublishSubscribeService = new PublishSubscribeService();
  pubSubService.subscribe("sale", saleSubscriber);
  pubSubService.subscribe("refill", refillSubscriber);
  pubSubService.subscribe("stock_low", stockWarningSubscriber);
  pubSubService.subscribe("stock_ok", stockOkSubscriber1);
  console.log(pubSubService);

  pubSubService.unsubscribe(stockOkSubscriber1);
  console.log("unsub 1", pubSubService);

  pubSubService.unsubscribe(stockWarningSubscriber);
  console.log("unsub 2", pubSubService);

  pubSubService.unsubscribe(saleSubscriber);
  pubSubService.unsubscribe(refillSubscriber);
  console.log(pubSubService);
};

const main = async () => {
  title("main");
  // create 3 machines with a quantity of 10 stock
  const machines: Machine[] = [
    new Machine("001"),
    new Machine("002"),
    new Machine("003"),
  ];

  // create a machine sale event subscriber. inject the machines (all subscribers should do this)
  const saleSubscriber = new MachineSaleSubscriber(machines);
  const refillSubscriber = new MachineRefillSubscriber(machines);
  const stockWarningSubscriber = new MachineStockWarningSubscriber(machines);
  const stockOkSubscriber1 = new MachineStockOkSubscriber(machines);

  // create the PubSub service
  const pubSubService: IPublishSubscribeService = new PublishSubscribeService();
  pubSubService.subscribe("sale", saleSubscriber);
  pubSubService.subscribe("refill", refillSubscriber);
  pubSubService.subscribe("stock_low", stockWarningSubscriber);
  pubSubService.subscribe("stock_ok", stockOkSubscriber1);

  // create 5 random events
  const events = [1, 2, 3, 4, 5].map(() => eventGenerator());

  // publish the events
  events.map((event) => pubSubService.publish(event));
};

(async () => {
  const cases = [case1, case2, case3, case4, case5, case6, case7, case8, main];

  for (let i = 0; i < cases.length; i++) {
    console.log(`-------------- case ${i + 1} --------------`);
    await cases[i]();
  }
})();
