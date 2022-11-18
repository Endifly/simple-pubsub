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
        const isLowStock = machine.soldStock(event.getSoldQuantity());

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
        const isRefilled = machine.refillStock(event.getRefillQuantity());

        if (isRefilled) lazyFire(new StockLevelOkEvent(machine.id));
      }
    });
  }
}

// objects
class Machine {
  public stockLevel = 10;
  public id: string;
  public isLowStock: boolean;

  constructor(id: string) {
    this.id = id;
    this.isLowStock = false;
  }

  soldStock(soldAmount: number): boolean {
    if (soldAmount < 0) throw Error("sold amount should be 0 or more");
    this.stockLevel = Math.max(0, this.stockLevel - soldAmount);

    if (this.stockLevel < 3) this.isLowStock = true;

    return this.isLowStock;
  }

  refillStock(refillAmount: number) {
    if (refillAmount < 0) throw Error("sold amount should be 0 or more");
    this.stockLevel += refillAmount;

    const isRefilled = this.isLowStock && this.stockLevel > 3;

    if (this.stockLevel >= 3) this.isLowStock = false;

    return isRefilled;
  }
}

type ICallbackPool = {
  [type in EnumEvent]?: Array<ISubscriber>;
};

class PublishSubscribeService implements IPublishSubscribeService {
  public pool: ICallbackPool;
  private eventStack: IEvent[];

  constructor() {
    this.pool = {};
    this.eventStack = [];
  }

  private getCallbackPoll(type: EnumEvent): ISubscriber[] {
    const isTypeNotExist = !(type in this.pool);

    if (isTypeNotExist) {
      this.pool[type] = [];
    }

    return this.pool[type] as ISubscriber[];
  }

  private addEvent(event: IEvent): void {
    this.eventStack.unshift(event);
  }

  private executeEvent(): void {
    while (this.eventStack.length > 0) {
      const currEvent = this.eventStack.pop();
      // console.log("curr", currEvent);

      if (!currEvent) continue;

      /**
       * some event can cause new event such as refill can cause 'stockOk'
       * so if their event want to fire new event, this.addEvent will be called and add event to stack
       * so those event will be called at next loop after currEvent has finished
       */
      this.getCallbackPoll(currEvent.type()).forEach((handler) => {
        handler.handle(currEvent, this.addEvent.bind(this));
      });
    }
  }

  publish(event: IEvent): void {
    this.addEvent(event);
    this.executeEvent();
  }

  subscribe(type: EnumEvent, handler: ISubscriber): void {
    this.getCallbackPoll(type).push(handler);
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
  const events = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(() => eventGenerator());

  // publish the events
  // console.log(machines);
  events.map((event) => pubSubService.publish(event));
  // pubSubService.publish(new MachineSaleEvent(8, "002"));
  // pubSubService.publish(new MachineSaleEvent(7, "003"));
  // pubSubService.publish(new MachineRefillEvent(5, "002"));
  // pubSubService.publish(new MachineRefillEvent(5, "003"));

  // pubSubService.publish(new MachineSaleEvent(7, "003"));
  // pubSubService.publish(new MachineRefillEvent(5, "003"));
  // pubSubService.publish(new MachineSaleEvent(7, "003"));
  // pubSubService.publish(new MachineRefillEvent(5, "003"));

  // console.log(machines);
})();
