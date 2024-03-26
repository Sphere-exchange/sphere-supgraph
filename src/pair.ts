import {
  BigInt,
  BigDecimal,
  store,
  Address,
  log,
} from '@graphprotocol/graph-ts'
import {
  SphereFactory,
  Pair,
  Token,
  User,
  HistoryOrder,
  HistoryMarket,
  Transaction,
  PairDataAtTimestamp,
} from '../generated/schema'
import {
  SumMarketOrder,
  RemoveOrder,
  MarketOrder,
  RemoveOrderNoUpdateBalances,
  CreateLimitOrder,
} from '../generated/templates/Pair/Pair'
import {
  FACTORY_ADDRESS,
  createUser,
  ONE_BI,
  convertTokenToDecimal,
  BI_18,
  ZERO_BD,
  calculateVolume24HToken,
} from './helpers'

export function handleCreateLimitOrder(event: CreateLimitOrder): void {
  // add transactions Count
  let factory = SphereFactory.load(FACTORY_ADDRESS)
  if (factory !== null) {
    factory.txCount = factory.txCount.plus(ONE_BI)
    factory.save()
  }

  let pair = Pair.load(event.params.pair.toHexString())
  if (pair != null) {
    pair.txCount = pair.txCount.plus(ONE_BI)
    pair.save()
  }

  // user stats
  createUser(event.params.trader)

  // get or create transaction
  let transactionHash = event.transaction.hash.toHexString()
  let transaction = Transaction.load(transactionHash)
  if (transaction === null) {
    transaction = new Transaction(transactionHash)
    transaction.blockNumber = event.block.number
    transaction.timestamp = event.block.timestamp
  }
}

export function handleRemoveOrder(event: RemoveOrder): void {
  let transactionHash = event.transaction.hash.toHexString()

  // add transactions Count
  let factory = SphereFactory.load(FACTORY_ADDRESS)
  if (factory !== null) {
    factory.txCount = factory.txCount.plus(ONE_BI)
    factory.save()
  }

  let pair = Pair.load(event.params.pair.toHexString())
  if (pair != null) {
    pair.txCount = pair.txCount.plus(ONE_BI)
    pair.save()
  }

  // user stats
  createUser(event.params.trader)

  // get or create transaction
  let transaction = Transaction.load(transactionHash)
  if (transaction === null) {
    transaction = new Transaction(transactionHash)
    transaction.blockNumber = event.block.number
    transaction.timestamp = event.block.timestamp
  }

  // load HistoryOrder (create if first historyOrder)
  let historyOrder = HistoryOrder.load(transactionHash)
  if (historyOrder === null) {
    historyOrder = new HistoryOrder(transactionHash)
  }
  historyOrder.trader = event.params.trader.toHexString()
  historyOrder.pair = event.params.pair.toHexString()
  historyOrder.type = 'Limit'
  historyOrder.isBuy = event.params.isBuy
  historyOrder.amount = event.params.amount
  historyOrder.price = event.params.price
  historyOrder.executed = event.params.executed
  historyOrder.date = event.params.date
  historyOrder.action = 'Canceled'
  transaction.historyOrders = historyOrder.id

  historyOrder.save()
  transaction.save()
}

export function handleRemoveOrderNoUpdateBalances(
  event: RemoveOrderNoUpdateBalances
): void {
  let transactionHash = event.transaction.hash.toHexString()
  // user stats
  createUser(event.params.trader)

  // get or create transaction
  let transaction = Transaction.load(transactionHash)
  if (transaction === null) {
    transaction = new Transaction(transactionHash)
    transaction.blockNumber = event.block.number
    transaction.timestamp = event.block.timestamp
  }

  // load HistoryOrder (create if first historyOrder)
  let historyOrder = HistoryOrder.load(transactionHash)
  while (historyOrder !== null) {
    transactionHash += '!'
    historyOrder = HistoryOrder.load(transactionHash)
  }
  if (historyOrder === null) {
    historyOrder = new HistoryOrder(transactionHash)
  }

  historyOrder.trader = event.params.trader.toHexString()
  historyOrder.pair = event.params.pair.toHexString()
  historyOrder.type = 'Limit'
  historyOrder.isBuy = event.params.isBuy
  historyOrder.amount = event.params.amount
  historyOrder.price = event.params.price
  historyOrder.executed = event.params.executed
  historyOrder.date = event.params.date
  historyOrder.action = 'Filled'
  transaction.historyOrders = historyOrder.id

  historyOrder.save()
  transaction.save()
}

export function handleSumMarketOrder(event: SumMarketOrder): void {
  let transactionHash = event.transaction.hash.toHexString()

  // add transactions Count
  let factory = SphereFactory.load(FACTORY_ADDRESS)
  if (factory !== null) {
    factory.txCount = factory.txCount.plus(ONE_BI)
    factory.save()
  }

  let pair = Pair.load(event.params.pair.toHexString())
  if (pair != null) {
    pair.txCount = pair.txCount.plus(ONE_BI)
    pair.save()
  }

  // user stats
  createUser(event.params.trader)

  // get or create transaction
  let transaction = Transaction.load(transactionHash)
  if (transaction === null) {
    transaction = new Transaction(transactionHash)
    transaction.blockNumber = event.block.number
    transaction.timestamp = event.block.timestamp
  }

  // load HistoryOrder (create if first historyOrder)
  let historyOrder = HistoryOrder.load(transactionHash)
  while (historyOrder !== null) {
    transactionHash += '!'
    historyOrder = HistoryOrder.load(transactionHash)
  }
  if (historyOrder === null) {
    historyOrder = new HistoryOrder(transactionHash)
  }

  historyOrder.trader = event.params.trader.toHexString()
  historyOrder.pair = event.params.pair.toHexString()
  historyOrder.type = 'Market'
  historyOrder.isBuy = event.params.isBuy === 0 ? 1 : 0 // toggle isBuy in Market
  historyOrder.amount = event.params.amount //  convertTokenToDecimal(event.params.amount0In, token0.decimals)
  historyOrder.price = event.params.price
  historyOrder.executed = event.params.executed
  historyOrder.date = event.params.date
  transaction.historyOrders = historyOrder.id

  if (historyOrder.executed.plus(BigInt.fromI32(1000)) >= historyOrder.amount) {
    historyOrder.action = 'Filled'
  } else {
    historyOrder.action = 'Partially filled'
  }

  historyOrder.save()
  transaction.save()
}

export function handleMarketOrder(event: MarketOrder): void {
  let transactionHash = event.transaction.hash.toHexString()

  // user stats
  createUser(event.params.trader)

  // calculate volume
  calculateVolume24HToken(event)

  // get or create transaction
  let transaction = Transaction.load(transactionHash)
  if (transaction === null) {
    transaction = new Transaction(transactionHash)
    transaction.blockNumber = event.block.number
    transaction.timestamp = event.block.timestamp
  }

  // load HistoryMarket (create if first historyMarket)
  let historyMarket = HistoryMarket.load(transactionHash)
  while (historyMarket !== null) {
    transactionHash += '!'
    historyMarket = HistoryMarket.load(transactionHash)
  }

  if (historyMarket === null) {
    historyMarket = new HistoryMarket(transactionHash)
  }
  historyMarket.trader = event.params.trader.toHexString()
  historyMarket.pair = event.params.pair.toHexString()
  historyMarket.isBuy = event.params.isBuy === 0 ? 1 : 0 // toggle isBuy in Market
  historyMarket.amount = event.params.amount
  historyMarket.price = event.params.price
  historyMarket.date = event.params.date
  transaction.historyOrders = historyMarket.id

  historyMarket.save()
  transaction.save()
}
