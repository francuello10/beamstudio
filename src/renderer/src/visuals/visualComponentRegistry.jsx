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

const withNowPlayingPart = (part) => forwardRef((props, ref) => (
    <NowPlayingCardVisual {...props} ref={ref} part={part} />
))

const withEqualizerOptions = (model, intensity = 'standard') => forwardRef((props, ref) => (
    <MusicEqualizerVisual {...props} ref={ref} model={model} intensity={intensity} />
))

const withBassIntensity = (intensity) => forwardRef((props, ref) => (
    <BassPulseVisual {...props} ref={ref} intensity={intensity} />
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
    bassPulseExaggerated: withBassIntensity('exaggerated')
}
