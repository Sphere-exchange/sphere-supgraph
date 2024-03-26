import { PairCreated as PairCreatedEvent } from '../generated/Factory/Factory'
import { SphereFactory, Pair, Token } from '../generated/schema'
import { log } from '@graphprotocol/graph-ts'
import { Pair as PairTemplate } from '../generated/templates'
import {
  FACTORY_ADDRESS,
  ZERO_BI,
  ZERO_BD,
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
} from './helpers'

export function handlePairCreated(event: PairCreatedEvent): void {
  // load factory (create if first exchange)
  let factory = SphereFactory.load(FACTORY_ADDRESS)

  if (factory === null) {
    factory = new SphereFactory(FACTORY_ADDRESS)
    factory.pairCount = 0
    factory.txCount = ZERO_BI
  }

  factory.pairCount = factory.pairCount + 1
  factory.save()

  // create the tokens
  let token0 = Token.load(event.params.token0.toHexString())
  let token1 = Token.load(event.params.token1.toHexString())

  // fetch info if null
  if (token0 === null) {
    token0 = new Token(event.params.token0.toHexString())
    token0.symbol = fetchTokenSymbol(event.params.token0)
    token0.name = fetchTokenName(event.params.token0)
    let decimals = fetchTokenDecimals(event.params.token0)

    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      log.debug('mybug the decimal on token 0 was null', [])
      return
    }

    token0.decimals = decimals
  }

  // fetch info if null
  if (token1 === null) {
    token1 = new Token(event.params.token1.toHexString())
    token1.symbol = fetchTokenSymbol(event.params.token1)
    token1.name = fetchTokenName(event.params.token1)
    let decimals = fetchTokenDecimals(event.params.token1)

    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      return
    }
    token1.decimals = decimals
  }

  let pair = new Pair(event.params.pair.toHexString()) as Pair
  pair.token0 = token0.id
  pair.token1 = token1.id
  pair.createdAtTimestamp = event.block.timestamp
  pair.createdAtBlockNumber = event.block.number
  pair.updateStatsAtTimestamp = event.block.timestamp
  pair.updateStatsAtBlockNumber = event.block.number
  pair.totalVolumeToken0 = ZERO_BD
  pair.totalVolumeToken1 = ZERO_BD
  pair.change24H = ZERO_BD
  pair.high24H = ZERO_BD
  pair.low24H = ZERO_BD
  pair.volumeToken024H = ZERO_BD
  pair.volumeToken124H = ZERO_BD
  pair.txCount = ZERO_BI
  pair.price = ZERO_BD
  pair.lastIndexPairData = 0
  // create the tracked contract based on the template
  PairTemplate.create(event.params.pair)

  // save updated values
  token0.save()
  token1.save()
  pair.save()
  factory.save()
}
