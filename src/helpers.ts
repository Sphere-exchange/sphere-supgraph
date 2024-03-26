import {
  log,
  BigInt,
  BigDecimal,
  Address,
  ethereum,
} from '@graphprotocol/graph-ts'
import { ERC20 } from '../generated/Factory/ERC20'
import { ERC20SymbolBytes } from '../generated/Factory/ERC20SymbolBytes'
import { ERC20NameBytes } from '../generated/Factory/ERC20NameBytes'
import { Pair, PairDataAtTimestamp, User } from '../generated/schema'
import { MarketOrder } from '../generated/templates/Pair/Pair'

export const FACTORY_ADDRESS = '0xD4381D573ab01095e12a2B65313771Fc17Ef3aDF'

export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let BI_18 = BigInt.fromI32(18)

export function isNullEthValue(value: string): boolean {
  return (
    value ==
    '0x0000000000000000000000000000000000000000000000000000000000000001'
  )
}
export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString('1')
  for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
    bd = bd.times(BigDecimal.fromString('10'))
  }
  return bd
}

export function createUser(address: Address): void {
  let user = User.load(address.toHexString())
  if (user === null) {
    user = new User(address.toHexString())
    user.save()
  }
}
export function convertTokenToDecimal(
  tokenAmount: BigInt,
  exchangeDecimals: BigInt
): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return tokenAmount.toBigDecimal()
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals))
}

export function fetchTokenSymbol(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress)
  let contractSymbolBytes = ERC20SymbolBytes.bind(tokenAddress)

  // try types string and bytes32 for symbol
  let symbolValue = 'unknown'
  let symbolResult = contract.try_symbol()
  if (symbolResult.reverted) {
    let symbolResultBytes = contractSymbolBytes.try_symbol()
    if (!symbolResultBytes.reverted) {
      // for broken pairs that have no symbol function exposed
      if (!isNullEthValue(symbolResultBytes.value.toHexString())) {
        symbolValue = symbolResultBytes.value.toString()
      }
    }
  } else {
    symbolValue = symbolResult.value
  }

  return symbolValue
}

export function fetchTokenName(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress)
  let contractNameBytes = ERC20NameBytes.bind(tokenAddress)

  // try types string and bytes32 for name
  let nameValue = 'unknown'
  let nameResult = contract.try_name()
  if (nameResult.reverted) {
    let nameResultBytes = contractNameBytes.try_name()
    if (!nameResultBytes.reverted) {
      // for broken exchanges that have no name function exposed
      if (!isNullEthValue(nameResultBytes.value.toHexString())) {
        nameValue = nameResultBytes.value.toString()
      }
    }
  } else {
    nameValue = nameResult.value
  }

  return nameValue
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
  let contract = ERC20.bind(tokenAddress)
  // try types uint8 for decimals
  let decimalValue = 0
  let decimalResult = contract.try_decimals()
  if (!decimalResult.reverted) {
    decimalValue = decimalResult.value
  }
  return BigInt.fromI32(decimalValue as i32)
}

export function calculateVolume24HToken(event: MarketOrder): void {
  let pair = Pair.load(event.params.pair.toHexString())
  let volumeToken0 = ZERO_BD
  let volumeToken1 = ZERO_BD
  let amount = convertTokenToDecimal(event.params.amount, BI_18)
  let price = convertTokenToDecimal(event.params.price, BI_18)
  let isBuy = event.params.isBuy === 0 ? 1 : 0 // toggle isBuy in Market
  if (isBuy == 0) {
    // isBuy = 0 -> Buy token0 Sell token 1
    volumeToken0 = amount.div(price)
    volumeToken1 = amount
  } else if (isBuy == 1) {
    // isBuy = 1 -> Buy token1 Sell token 0
    volumeToken0 = amount
    volumeToken1 = amount.times(price)
  }

  // load PairDataAtTimestamp (create if first PairDataAtTimestamp)
  let idPairDataAtTimestamp = event.block.timestamp.toString()
  let pairData = PairDataAtTimestamp.load(idPairDataAtTimestamp)
  while (pairData !== null) {
    idPairDataAtTimestamp += 'P'
    pairData = PairDataAtTimestamp.load(idPairDataAtTimestamp)
  }
  pairData = new PairDataAtTimestamp(idPairDataAtTimestamp)
  pairData.volumeToken0 = volumeToken0
  pairData.volumeToken1 = volumeToken1
  pairData.price = price
  pairData.pair = event.params.pair.toHexString()
  pairData.date = event.block.timestamp
  pairData.save()

  if (pair != null) {
    let lastTimeStamp = event.block.timestamp.toI32() - 86400 // 24h
    let volumeToken024H = pair.volumeToken024H
    let volumeToken124H = pair.volumeToken124H

    let loadPairDataAtTimestamp = pair.pairDataAtTimestamp.load()
    let length = loadPairDataAtTimestamp.length
    let lastIndexPairData = pair.lastIndexPairData
    while (
      lastIndexPairData < length &&
      loadPairDataAtTimestamp[lastIndexPairData].date.toI32() < lastTimeStamp
    ) {
      volumeToken024H.minus(
        loadPairDataAtTimestamp[lastIndexPairData].volumeToken0
      )
      volumeToken124H.minus(
        loadPairDataAtTimestamp[lastIndexPairData].volumeToken1
      )
      lastIndexPairData += 1
    }

    // change24H
    if (pair.price == ZERO_BD) {
      pair.change24H = ZERO_BD
      pair.high24H = price
      pair.low24H = price
    } else {
      let item = loadPairDataAtTimestamp.slice(lastIndexPairData)
      item.sort((a, b) => <i32>parseFloat(a.price.minus(b.price).toString()))
      pair.high24H = item[item.length - 1].price
      pair.low24H = item[0].price

      // if (length - 1 <= lastIndexPairData) {
      //   pair.change24H = ZERO_BD
      // } else {}
      pair.change24H = price
        .minus(loadPairDataAtTimestamp[lastIndexPairData].price)
        .div(
          loadPairDataAtTimestamp[lastIndexPairData].price.div(
            BigDecimal.fromString('100')
          )
        )
    }

    volumeToken024H = volumeToken024H.plus(volumeToken0)
    volumeToken124H = volumeToken124H.plus(volumeToken1)

    pair.volumeToken024H = volumeToken024H
    pair.volumeToken124H = volumeToken124H
    pair.lastIndexPairData = lastIndexPairData

    pair.price = price
    pair.txCount = pair.txCount.plus(ONE_BI)
    pair.totalVolumeToken0 = pair.totalVolumeToken0.plus(volumeToken0)
    pair.totalVolumeToken1 = pair.totalVolumeToken1.plus(volumeToken1)
    pair.updateStatsAtTimestamp = event.block.timestamp
    pair.updateStatsAtBlockNumber = event.block.number
    pair.save()
  }
}
