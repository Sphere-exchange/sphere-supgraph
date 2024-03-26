import {
  BigInt,
  BigDecimal,
  store,
  Address,
  log,
} from '@graphprotocol/graph-ts'
import {
  HistoryWallet,
  Token,
  User,
  Transaction,
  SphereFactory,
} from '../generated/schema'
import {
  Deposit,
  Withdraw,
  TransferBetweenAccounts,
} from '../generated/MainValueWallet/MainValueWallet'
import {
  FACTORY_ADDRESS,
  createUser,
  ONE_BI,
  convertTokenToDecimal,
  BI_18,
  ZERO_BD,
  calculateVolume24HToken,
} from './helpers'

export function handleDeposit(event: Deposit): void {
  let transactionHash = event.transaction.hash.toHexString()

  // add transactions Count
  let factory = SphereFactory.load(FACTORY_ADDRESS)
  if (factory !== null) {
    factory.txCount = factory.txCount.plus(ONE_BI)
    factory.save()
  }

  let historyWallet = HistoryWallet.load(transactionHash)
  if (historyWallet === null) {
    historyWallet = new HistoryWallet(transactionHash)
    historyWallet.from = event.params.user.toHexString()
    historyWallet.token = event.params.addressToken.toHexString()
    historyWallet.amount = event.params.amount
    historyWallet.action = 'Deposit'
  }

  // user stats
  createUser(event.params.user)

  // get or create transaction
  let transaction = Transaction.load(transactionHash)
  if (transaction === null) {
    transaction = new Transaction(transactionHash)
    transaction.blockNumber = event.block.number
    transaction.timestamp = event.block.timestamp
  }
  transaction.historyWallet = historyWallet.id

  historyWallet.save()
  transaction.save()
}

export function handleWithdraw(event: Withdraw): void {
  let transactionHash = event.transaction.hash.toHexString()

  // add transactions Count
  let factory = SphereFactory.load(FACTORY_ADDRESS)
  if (factory !== null) {
    factory.txCount = factory.txCount.plus(ONE_BI)
    factory.save()
  }

  let historyWallet = HistoryWallet.load(transactionHash)
  if (historyWallet === null) {
    historyWallet = new HistoryWallet(transactionHash)
    historyWallet.from = event.params.user.toHexString()
    historyWallet.token = event.params.addressToken.toHexString()
    historyWallet.amount = event.params.amount
    historyWallet.action = 'Withdraw'
  }

  // user stats
  createUser(event.params.user)

  // get or create transaction
  let transaction = Transaction.load(transactionHash)
  if (transaction === null) {
    transaction = new Transaction(transactionHash)
    transaction.blockNumber = event.block.number
    transaction.timestamp = event.block.timestamp
  }
  transaction.historyWallet = historyWallet.id

  historyWallet.save()
  transaction.save()
}

export function handleTransferBetweenAccounts(
  event: TransferBetweenAccounts
): void {
  let transactionHash = event.transaction.hash.toHexString()

  // add transactions Count
  let factory = SphereFactory.load(FACTORY_ADDRESS)
  if (factory !== null) {
    factory.txCount = factory.txCount.plus(ONE_BI)
    factory.save()
  }

  let historyWallet = HistoryWallet.load(transactionHash)
  if (historyWallet === null) {
    historyWallet = new HistoryWallet(transactionHash)
    historyWallet.from = event.params.from.toHexString()
    historyWallet.token = event.params.addressToken.toHexString()
    historyWallet.amount = event.params.amount
    historyWallet.to = event.params.to.toHexString()
    historyWallet.action = 'TransferBetweenAccounts'
  }

  // user stats
  createUser(event.params.from)

  // get or create transaction
  let transaction = Transaction.load(transactionHash)
  if (transaction === null) {
    transaction = new Transaction(transactionHash)
    transaction.blockNumber = event.block.number
    transaction.timestamp = event.block.timestamp
  }
  transaction.historyWallet = historyWallet.id

  historyWallet.save()
  transaction.save()
}
