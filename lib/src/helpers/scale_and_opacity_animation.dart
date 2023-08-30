import 'package:flutter/material.dart';

class ScaleAndOpacityAnimation extends StatefulWidget {
  final Duration opacityDuration;
  final Duration scaleDuration;
  final Tween<double> scaleTween;
  final Widget child;
  final Curve curve;

  const ScaleAndOpacityAnimation({
    super.key,
    required this.opacityDuration,
    Duration? scaleDuration,
    required this.scaleTween,
    required this.child,
    this.curve = Curves.easeOutExpo,
  }) : scaleDuration = scaleDuration ?? opacityDuration;

  @override
  State<ScaleAndOpacityAnimation> createState() =>
      _ScaleAndOpacityAnimationState();
}

class _ScaleAndOpacityAnimationState extends State<ScaleAndOpacityAnimation>
    with TickerProviderStateMixin {
  late final AnimationController fadeAnimationController;
  late final AnimationController scaleAnimationController;

  @override
  void initState() {
    super.initState();
    fadeAnimationController =
        AnimationController(vsync: this, duration: widget.opacityDuration);
    fadeAnimationController.forward();
    scaleAnimationController =
        AnimationController(vsync: this, duration: widget.scaleDuration);
    scaleAnimationController.forward();
  }

  @override
  void dispose() {
    fadeAnimationController.dispose();
    scaleAnimationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: Tween(begin: 0.0, end: 1.0)
          .chain(CurveTween(curve: widget.curve))
          .evaluate(fadeAnimationController),
      child: Transform.scale(
        scale: widget.scaleTween.evaluate(scaleAnimationController),
        child: widget.child,
      ),
    );
  }
}
