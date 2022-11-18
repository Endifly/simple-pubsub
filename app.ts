// interfaces
interface IEvent {
  type(): EnumEvent;
  machineId(): string;
}

type IAddEvent = (event: IEvent) => void;

interface ISubscriber {
  handle(event: IEvent, fire?: IAddEvent): void;
}

interface IPublishSubscribeService {
  publish(event: IEvent): void;
  subscribe(type: EnumEvent, handler: ISubscriber): void;
  // unsubscribe ( /* Question 2 - build this feature */ );
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
    console.log("LowStockWarningEvent fired on machine : ", event.machineId());
  }
}

class MachineStockOkSubscriber implements ISubscriber {
  public machines: Machine[];

  constructor(machines: Machine[]) {
    this.machines = machines;
  }

  handle(event: StockLevelOkEvent): void {
    console.log("StockLevelOkEvent fired on machine : ", event.machineId());
  }
}

class MachineSaleSubscriber implements ISubscriber {
  public machines: Machine[];

  constructor(machines: Machine[]) {
    this.machines = machines;
  }

  handle(event: MachineSaleEvent, add: IAddEvent): void {
    // this.machines[2].stockLevel -= event.getSoldQuantity();
    this.machines.forEach((machine) => {
      if (machine.id === event.machineId()) {
        machine.stockLevel -= event.getSoldQuantity();
        if (machine.stockLevel < 3) {
          add(new LowStockWarningEvent(machine.id));
        }
      }
    });
  }
}

class MachineRefillSubscriber implements ISubscriber {
  public machines: Machine[];

  constructor(machines: Machine[]) {
    this.machines = machines;
  }

  handle(event: MachineRefillEvent, add: IAddEvent): void {
    this.machines.forEach((machine) => {
      if (machine.id === event.machineId()) {
        machine.stockLevel += event.getRefillQuantity();
        if (machine.stockLevel > 3) {
          add(new StockLevelOkEvent(machine.id));
        }
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
}

type ICallbackPool = {
  [type in EnumEvent]: Array<ISubscriber>;
};

class PublishSubscribeService implements IPublishSubscribeService {
  public pool: ICallbackPool;
  private eventStack: IEvent[];

  constructor() {
    this.pool = {
      refill: [],
      sale: [],
      stock_low: [],
      stock_ok: [],
    };
    this.eventStack = [];
  }

  addEvent(event: IEvent): void {
    this.eventStack.push(event);
  }

  executeEvent(): void {
    while (this.eventStack.length > 0) {
      const currEvent = this.eventStack.pop();

      if (!currEvent) continue;

      this.pool[currEvent.type()].forEach((handler) => {
        handler.handle(currEvent, this.addEvent.bind(this));
      });
    }
  }

  publish(event: IEvent): void {
    this.addEvent(event);
    this.executeEvent();
  }

  subscribe(type: EnumEvent, handler: ISubscriber): void {
    this.pool[type].push(handler);
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

// program
(async () => {
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
  const stockOkSubscriber = new MachineStockOkSubscriber(machines);

  // create the PubSub service
  const pubSubService: IPublishSubscribeService = new PublishSubscribeService();
  pubSubService.subscribe("sale", saleSubscriber);
  pubSubService.subscribe("refill", refillSubscriber);
  pubSubService.subscribe("stock_low", stockWarningSubscriber);
  pubSubService.subscribe("stock_ok", stockOkSubscriber);

  // create 5 random events
  const events = [1, 2, 3, 4, 5].map(() => eventGenerator());

  // publish the events
  console.log(machines);
  events.map((event) => pubSubService.publish(event));
  console.log(machines);
})();
