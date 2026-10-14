export const shakemapContours = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        value: 1.5,
        units: 'mmi',
        color: '#dfe6ff',
        weight: 4,
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [-5.8333, 38.5579],
            [-5.7548, 38.556],
            [-5.6538, 38.4954],
          ],
          [
            [-5.5916, 38.8667],
            [-5.5752, 38.8309],
            [-5.5804, 38.7951],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        value: 2.0,
        units: 'mmi',
        color: '#bfccff',
        weight: 2,
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [-4.2671, 38.8667],
            [-4.2785, 38.8398],
            [-4.2062, 38.8009],
          ],
          [
            [-3.9037, 38.8667],
            [-3.904, 38.8398],
            [-3.9256, 38.8314],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        value: 2.5,
        units: 'mmi',
        color: '#afd9ff',
        weight: 4,
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [-3.5441, 35.9204],
            [-3.6563, 35.914],
            [-3.7348, 35.9181],
          ],
          [
            [-2.7585, 37.9531],
            [-2.7833, 37.9625],
            [-2.7879, 37.9715],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        value: 4,
        units: 'mmi',
        color: '#80ffff',
        weight: 2,
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-4.5, 36.1],
          [-4.2, 36.4],
        ],
      },
    },
  ],
};
