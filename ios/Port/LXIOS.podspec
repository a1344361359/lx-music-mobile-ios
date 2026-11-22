Pod::Spec.new do |s|
  s.name = 'LXIOS'
  s.version = '1.0.0'
  s.summary = 'iOS platform implementations for LX Music Mobile'
  s.homepage = 'https://github.com/lyswhut/lx-music-mobile'
  s.license = { :type => 'Apache-2.0' }
  s.author = 'LX Music iOS port'
  s.platform = :ios, '15.0'
  s.source = { :git => 'https://github.com/lyswhut/lx-music-mobile.git' }
  s.source_files = '*.{h,m,swift}'
  s.resources = ['user-api-preload.js', 'icomoon.ttf']
  s.frameworks = 'UIKit', 'JavaScriptCore', 'Security', 'UniformTypeIdentifiers', 'AVFoundation'
  s.weak_frameworks = 'ActivityKit'
  s.swift_version = '5.0'
  s.dependency 'React-Core'
end
