import 'dart:ui';

import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/animation_builder/loop_animation_builder.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

typedef TextBoxInfo = ({String character, TextBox box, int index});

class TextAnimationWidget extends StatelessWidget {
  final TextStyle? textStyle;

  final TextAnimationBuilder builder;

  final TextAlign textAlign;

  const TextAnimationWidget({
    super.key,
    required this.builder,
    this.textStyle,
    this.textAlign = TextAlign.center,
  });

  factory TextAnimationWidget.fromInput({
    required CharacterAnimationInput animationInput,
    TextStyle? textStyle,
    required PipelineStep pipelineStep,
    TextAlign textAlign = TextAlign.start,
  }) {
    return TextAnimationWidget(
      builder: TextAnimationBuilder(animationInput).add(pipelineStep),
      textStyle: textStyle,
      textAlign: textAlign,
    );
  }

  MovieTween get tween => builder.tween;

  List<AnimationProperty> get animationProperties =>
      builder.animationProperties;

  AnimationInput get animationInput => builder.animationInput;

  ({Size overallBoxSize, Iterable<TextBoxInfo> boxes}) getCharacterDetails(
      BuildContext context, BoxConstraints constraints) {
    final text = animationInput.text;
    final defaultTextStyle = DefaultTextStyle.of(context);
    final textStyle = defaultTextStyle.style.merge(this.textStyle);
    final textPainter = TextPainter(
      text: TextSpan(text: text, style: textStyle),
      textDirection: TextDirection.ltr,
      textAlign: textAlign,
      textScaleFactor: MediaQuery.textScaleFactorOf(context),
      maxLines: defaultTextStyle.maxLines,
      textWidthBasis: defaultTextStyle.textWidthBasis,
      textHeightBehavior: defaultTextStyle.textHeightBehavior ??
          DefaultTextHeightBehavior.maybeOf(context),
    );
    textPainter.layout(maxWidth: constraints.maxWidth);

    final boxes = <TextBoxInfo>[];
    for (int i = 0; i < text.length; i++) {
      final selectionRects = textPainter.getBoxesForSelection(
        TextSelection(baseOffset: i, extentOffset: i + 1),
        boxHeightStyle: BoxHeightStyle.max,
        boxWidthStyle: BoxWidthStyle.max,
      );

      if (selectionRects.isNotEmpty) {
        boxes.add((character: text[i], box: selectionRects.first, index: i));
      }
    }
    final boxSize = textPainter.size;
    textPainter.dispose();
    return (boxes: boxes, overallBoxSize: boxSize);
  }

  Widget renderCharacter(
      AnimationProperty animationProperty, Movie movie, TextBoxInfo info) {
    return Opacity(
      opacity: animationProperty.opacity.fromOrDefault(movie).clamp(0, 1),
      child: Transform(
        alignment: animationProperty.transformation
            .fromOrDefault(movie)
            .transformAlignment,
        transform: animationProperty.transformation.fromOrDefault(movie).matrix,
        child: Text.rich(
          TextSpan(text: info.character),
          style: textStyle,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final boxInfo = getCharacterDetails(context, constraints);
      return SizedBox.fromSize(
        size: boxInfo.overallBoxSize,
        child: LoopAnimationBuilder(
          tween: tween,
          builder: (context, movie, child) {
            return Stack(
              clipBehavior: Clip.none,
              children: boxInfo.boxes
                  .mapIndexed(
                    (i, e) => renderCharacterAnimation(e, movie),
                  )
                  .toList(growable: false),
            );
          },
          duration: tween.duration,
        ),
      );
    });
  }

  Positioned renderCharacterAnimation(TextBoxInfo info, Movie movie) {
    return Positioned(
      top: info.box.top,
      left: info.box.left,
      child: renderCharacter(
          animationProperties.elementAt(info.index), movie, info),
    );
  }
}
