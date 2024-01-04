import 'dart:ui';

import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/extensions.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/simple_animations.dart';

typedef TextBoxInfo = ({String character, TextBox box, int index});

class TextAnimationWidget extends StatelessWidget {
  final TextStyle? textStyle;

  final TextAnimationBuilder builder;

  final TextAlign textAlign;

  final bool loop;

  const TextAnimationWidget({
    super.key,
    required this.builder,
    this.textStyle,
    this.textAlign = TextAlign.center,
    this.loop = true,
  });

  factory TextAnimationWidget.fromInput({
    required CharacterAnimationInput animationInput,
    TextStyle? textStyle,
    required PipelineStep<TextAnimationBuilder> pipelineStep,
    TextAlign textAlign = TextAlign.center,
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
    int charOffset = 0;
    text.characters.forEachIndexed((i, char) {
      final selectionRects = textPainter.getBoxesForSelection(
        TextSelection(
            baseOffset: charOffset, extentOffset: charOffset + char.length),
        boxHeightStyle: BoxHeightStyle.max,
        boxWidthStyle: BoxWidthStyle.max,
      );
      charOffset += char.length;
      if (selectionRects.isNotEmpty) {
        boxes.add((character: char, box: selectionRects.first, index: i));
      }
    });
    final boxSize = textPainter.size;
    textPainter.dispose();
    return (boxes: boxes, overallBoxSize: boxSize);
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: textAlign.toAlignment(),
      child: LayoutBuilder(builder: (context, constraints) {
        final boxInfo = getCharacterDetails(context, constraints);
        return SizedBox.fromSize(
          size: boxInfo.overallBoxSize,
          child: CustomAnimationBuilder(
            tween: tween,
            control: loop ? Control.loop : Control.play,
            builder: (context, movie, child) {
              return Stack(
                clipBehavior: Clip.none,
                children: boxInfo.boxes
                    .map((info) => renderCharacterAnimation(info, movie))
                    .toList(growable: false),
              );
            },
            duration: tween.duration,
          ),
        );
      }),
    );
  }

  Positioned renderCharacterAnimation(TextBoxInfo info, Movie movie) {
    final animationProperty = animationProperties.elementAt(info.index);
    return Positioned(
      top: info.box.top,
      left: info.box.left,
      child: Opacity(
        opacity: animationProperty.opacity.fromOrDefault(movie).clamp(0, 1),
        child: Transform(
          alignment: animationProperty.transformation
              .fromOrDefault(movie)
              .transformAlignment,
          transform:
              animationProperty.transformation.fromOrDefault(movie).matrix,
          child: Text.rich(
            TextSpan(text: info.character),
            style: textStyle,
          ),
        ),
      ),
    );
  }
}
