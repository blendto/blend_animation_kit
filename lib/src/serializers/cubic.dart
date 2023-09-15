import 'package:flutter/animation.dart';

abstract class CurveSerializer {
  static String serialize(Curve curve) {
    if (curve == Curves.linear) {
      return 'linear';
    } else if (curve == Curves.decelerate) {
      return 'decelerate';
    } else if (curve == Curves.fastOutSlowIn) {
      return 'fastOutSlowIn';
    } else if (curve == Curves.ease) {
      return 'ease';
    } else if (curve == Curves.easeIn) {
      return 'easeIn';
    } else if (curve == Curves.easeOut) {
      return 'easeOut';
    } else if (curve == Curves.easeInOut) {
      return 'easeInOut';
    } else if (curve == Curves.fastLinearToSlowEaseIn) {
      return 'fastLinearToSlowEaseIn';
    } else if (curve == Curves.slowMiddle) {
      return 'slowMiddle';
    } else if (curve == Curves.bounceIn) {
      return 'bounceIn';
    } else if (curve == Curves.bounceOut) {
      return 'bounceOut';
    } else if (curve == Curves.bounceInOut) {
      return 'bounceInOut';
    } else if (curve == Curves.easeInSine) {
      return 'easeInSine';
    } else if (curve == Curves.easeInQuad) {
      return 'easeInQuad';
    } else if (curve == Curves.easeInCubic) {
      return 'easeInCubic';
    } else if (curve == Curves.easeInQuart) {
      return 'easeInQuart';
    } else if (curve == Curves.easeInQuint) {
      return 'easeInQuint';
    } else if (curve == Curves.easeInExpo) {
      return 'easeInExpo';
    } else if (curve == Curves.easeInCirc) {
      return 'easeInCirc';
    } else if (curve == Curves.easeInBack) {
      return 'easeInBack';
    } else if (curve == Curves.easeOutSine) {
      return 'easeOutSine';
    } else if (curve == Curves.easeOutQuad) {
      return 'easeOutQuad';
    } else if (curve == Curves.easeOutCubic) {
      return 'easeOutCubic';
    } else if (curve == Curves.easeOutQuart) {
      return 'easeOutQuart';
    } else if (curve == Curves.easeOutQuint) {
      return 'easeOutQuint';
    } else if (curve == Curves.easeOutExpo) {
      return 'easeOutExpo';
    } else if (curve == Curves.easeOutCirc) {
      return 'easeOutCirc';
    } else if (curve == Curves.easeOutBack) {
      return 'easeOutBack';
    } else if (curve == Curves.easeInOutSine) {
      return 'easeInOutSine';
    } else if (curve == Curves.easeInOutQuad) {
      return 'easeInOutQuad';
    } else if (curve == Curves.easeInOutCubic) {
      return 'easeInOutCubic';
    } else if (curve == Curves.easeInOutQuart) {
      return 'easeInOutQuart';
    } else if (curve == Curves.easeInOutQuint) {
      return 'easeInOutQuint';
    } else if (curve == Curves.easeInOutExpo) {
      return 'easeInOutExpo';
    } else if (curve == Curves.easeInOutCirc) {
      return 'easeInOutCirc';
    } else if (curve == Curves.easeInOutBack) {
      return 'easeInOutBack';
    } else if (curve == Curves.fastOutSlowIn) {
      return 'fastOutSlowIn';
    } else if (curve == Curves.slowMiddle) {
      return 'slowMiddle';
    } else if (curve == Curves.bounceIn) {
      return 'bounceIn';
    } else if (curve == Curves.bounceOut) {
      return 'bounceOut';
    } else if (curve == Curves.bounceInOut) {
      return 'bounceInOut';
    } else if (curve == Curves.elasticIn) {
      return 'elasticIn';
    } else if (curve == Curves.elasticOut) {
      return 'elasticOut';
    } else if (curve == Curves.elasticInOut) {
      return 'elasticInOut';
    } else {
      throw UnimplementedError("Unknown Curve");
    }
  }

  static Curve deserialize(String curveName) {
    switch (curveName) {
      case 'linear':
        return Curves.linear;
      case 'decelerate':
        return Curves.decelerate;
      case 'fastOutSlowIn':
        return Curves.fastOutSlowIn;
      case 'ease':
        return Curves.ease;
      case 'easeIn':
        return Curves.easeIn;
      case 'easeOut':
        return Curves.easeOut;
      case 'easeInOut':
        return Curves.easeInOut;
      case 'fastLinearToSlowEaseIn':
        return Curves.fastLinearToSlowEaseIn;
      case 'slowMiddle':
        return Curves.slowMiddle;
      case 'bounceIn':
        return Curves.bounceIn;
      case 'bounceOut':
        return Curves.bounceOut;
      case 'bounceInOut':
        return Curves.bounceInOut;
      case 'easeInSine':
        return Curves.easeInSine;
      case 'easeInQuad':
        return Curves.easeInQuad;
      case 'easeInCubic':
        return Curves.easeInCubic;
      case 'easeInQuart':
        return Curves.easeInQuart;
      case 'easeInQuint':
        return Curves.easeInQuint;
      case 'easeInExpo':
        return Curves.easeInExpo;
      case 'easeInCirc':
        return Curves.easeInCirc;
      case 'easeInBack':
        return Curves.easeInBack;
      case 'easeOutSine':
        return Curves.easeOutSine;
      case 'easeOutQuad':
        return Curves.easeOutQuad;
      case 'easeOutCubic':
        return Curves.easeOutCubic;
      case 'easeOutQuart':
        return Curves.easeOutQuart;
      case 'easeOutQuint':
        return Curves.easeOutQuint;
      case 'easeOutExpo':
        return Curves.easeOutExpo;
      case 'easeOutCirc':
        return Curves.easeOutCirc;
      case 'easeOutBack':
        return Curves.easeOutBack;
      case 'easeInOutSine':
        return Curves.easeInOutSine;
      case 'easeInOutQuad':
        return Curves.easeInOutQuad;
      case 'easeInOutCubic':
        return Curves.easeInOutCubic;
      case 'easeInOutQuart':
        return Curves.easeInOutQuart;
      case 'easeInOutQuint':
        return Curves.easeInOutQuint;
      case 'easeInOutExpo':
        return Curves.easeInOutExpo;
      case 'easeInOutCirc':
        return Curves.easeInOutCirc;
      case 'easeInOutBack':
        return Curves.easeInOutBack;
      case 'elasticIn':
        return Curves.elasticIn;
      case 'elasticOut':
        return Curves.elasticOut;
      case 'elasticInOut':
        return Curves.elasticInOut;
      default:
        throw UnimplementedError("Unknown Curve");
    }
  }
}
