import React, { forwardRef } from 'react'
import FluidNeonVisual from './FluidNeonVisual'
import ParticleFieldVisual from './ParticleFieldVisual'
import TunnelGridVisual from './TunnelGridVisual'
import KaleidoscopeVisual from './KaleidoscopeVisual'
import CeilingDomeVisual from './CeilingDomeVisual'
import PoseSkeletonVisual from './PoseSkeletonVisual'
import BlackNeutralVisual from './BlackNeutralVisual'
import NowPlayingCardVisual from './NowPlayingCardVisual'
import MusicEqualizerVisual from './MusicEqualizerVisual'
import BassPulseVisual from './BassPulseVisual'
import Wmp9SkinPackVisual from './Wmp9SkinPackVisual'

const withNowPlayingPart = (part) => forwardRef((props, ref) => (
    <NowPlayingCardVisual {...props} ref={ref} part={part} />
))

const withEqualizerOptions = (model, intensity = 'standard') => forwardRef((props, ref) => (
    <MusicEqualizerVisual {...props} ref={ref} model={model} intensity={intensity} />
))

const withBassIntensity = (intensity) => forwardRef((props, ref) => (
    <BassPulseVisual {...props} ref={ref} intensity={intensity} />
))

const withWmp9Variant = (variant, playerFrame = false) => forwardRef((props, ref) => (
    <Wmp9SkinPackVisual {...props} ref={ref} variant={variant} playerFrame={playerFrame} />
))

export const VISUAL_COMPONENTS = {
    blackNeutral: BlackNeutralVisual,
    fluidNeon: FluidNeonVisual,
    particleField: ParticleFieldVisual,
    tunnelGrid: TunnelGridVisual,
    kaleidoscope: KaleidoscopeVisual,
    ceilingDome: CeilingDomeVisual,
    poseSkeleton: PoseSkeletonVisual,

    nowPlayingCard: NowPlayingCardVisual,
    nowPlayingCover: withNowPlayingPart('cover'),
    nowPlayingTitle: withNowPlayingPart('title'),
    nowPlayingArtist: withNowPlayingPart('artist'),
    nowPlayingAlbum: withNowPlayingPart('album'),
    nowPlayingProgress: withNowPlayingPart('progress'),
    nowPlayingTime: withNowPlayingPart('time'),

    musicEqualizer: MusicEqualizerVisual,
    musicEqualizerSmooth: withEqualizerOptions('bars', 'smooth'),
    musicEqualizerExaggerated: withEqualizerOptions('bars', 'exaggerated'),
    musicEqualizerWave: withEqualizerOptions('wave'),
    musicEqualizerRadial: withEqualizerOptions('radial'),

    bassPulse: BassPulseVisual,
    bassPulseSmooth: withBassIntensity('smooth'),
    bassPulseExaggerated: withBassIntensity('exaggerated'),

    wmp9XpBars: withWmp9Variant('xpBars'),
    wmp9ClassicScope: withWmp9Variant('classicScope'),
    wmp9SpaceTunnel: withWmp9Variant('spaceTunnel'),
    wmp9Aquarium: withWmp9Variant('aquarium'),
    wmp9DaVinci: withWmp9Variant('daVinci'),
    wmp9Goo: withWmp9Variant('goo'),
    wmp9XpPlayer: withWmp9Variant('xpBars', true),
    wmp9ClassicPlayer: withWmp9Variant('classicScope', true),
    wmp9SpacePlayer: withWmp9Variant('spaceTunnel', true),
    wmp9AquariumPlayer: withWmp9Variant('aquarium', true),
    wmp9DaVinciPlayer: withWmp9Variant('daVinci', true),
    wmp9GooPlayer: withWmp9Variant('goo', true)
}
