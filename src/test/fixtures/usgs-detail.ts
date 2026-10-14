export const usgsPanamaDetail = {
  type: 'Feature',
  id: 'us6000u18k',
  geometry: {
    type: 'Point',
    coordinates: [-80.769, 7.5868, 12.647],
  },
  properties: {
    mag: 7.7,
    magType: 'mww',
    place: '12 km WSW of Pitaloza Arriba, Panama',
    time: 1791568566036,
    url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us6000u18k',
    tsunami: 0,
    alert: 'orange',
    status: 'reviewed',
    sig: 1790,
    felt: 1805,
    cdi: 7.9,
    mmi: 7.707,
    net: 'us',
    products: {
      dyfi: [
        {
          preferredWeight: 158,
          properties: {
            'num-responses': '1805',
            maxmmi: '7.9',
          },
        },
      ],
      losspager: [
        {
          preferredWeight: 158,
          properties: {
            alertlevel: 'orange',
          },
        },
      ],
      'moment-tensor': [
        {
          preferredWeight: 218,
          properties: {
            'nodal-plane-1-strike': '25.21',
            'nodal-plane-1-dip': '74.77',
            'nodal-plane-1-rake': '-155.3',
            'nodal-plane-2-strike': '288.32',
            'nodal-plane-2-dip': '66.22',
            'nodal-plane-2-rake': '-16.68',
            'percent-double-couple': '0.7789',
            'scalar-moment': '3.77E+20',
            'derived-magnitude': '7.7',
            'derived-magnitude-type': 'Mww',
            'derived-depth': '13.5',
          },
        },
        {
          preferredWeight: 160,
          properties: {
            'nodal-plane-1-strike': '26.64',
            'nodal-plane-1-dip': '73.44',
            'nodal-plane-1-rake': '-146.56',
            'nodal-plane-2-strike': '285.98',
            'nodal-plane-2-dip': '58.11',
            'nodal-plane-2-rake': '-19.62',
            'percent-double-couple': '0.8636',
            'scalar-moment': '3.89E+20',
            'derived-magnitude': '7.7',
            'derived-magnitude-type': 'Mwc',
            'derived-depth': '10',
          },
        },
      ],
      origin: [
        {
          preferredWeight: 158,
          properties: {
            'num-stations-used': '108',
            'standard-error': '0.84',
            'vertical-error': '3.947',
            'horizontal-error': '6.48',
            'review-status': 'reviewed',
            'azimuthal-gap': '45',
            'depth-type': 'from location',
            'num-phases-used': '108',
            'minimum-distance': '1.820',
          },
        },
        {
          preferredWeight: 6,
          properties: {
            'num-stations-used': '13',
            'review-status': 'REVIEWED',
            'azimuthal-gap': '136.7999890560008755199299584056033',
          },
        },
      ],
      shakemap: [
        {
          preferredWeight: 231,
          properties: {
            maxmmi: '7.707',
          },
          contents: {
            'download/cont_mmi.json': {
              url: 'https://earthquake.usgs.gov/product/shakemap/us6000u18k/us/1791835000028/download/cont_mmi.json',
            },
            'download/coverage_mmi_medium_res.covjson': {
              url: 'https://earthquake.usgs.gov/product/shakemap/us6000u18k/us/1791835000028/download/coverage_mmi_medium_res.covjson',
            },
            'download/mmi_legend.png': {
              url: 'https://earthquake.usgs.gov/product/shakemap/us6000u18k/us/1791835000028/download/mmi_legend.png',
            },
          },
        },
      ],
    },
  },
};

export const usgsOriginOnlyDetail = {
  type: 'Feature',
  id: 'us6000u23d',
  geometry: {
    type: 'Point',
    coordinates: [152.1142, -5.4162, 28.4],
  },
  properties: {
    mag: 5.1,
    magType: 'mb',
    place: '119 km S of Kokopo, Papua New Guinea',
    time: 1791908894303,
    url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us6000u23d',
    tsunami: 0,
    alert: null,
    status: 'reviewed',
    sig: 400,
    felt: null,
    cdi: null,
    mmi: null,
    net: 'us',
    products: {
      origin: [
        {
          preferredWeight: 158,
          properties: {
            'num-stations-used': '54',
            'standard-error': '0.71',
            'vertical-error': '5.469',
            'horizontal-error': '9.74',
            'review-status': 'reviewed',
            'azimuthal-gap': '89',
            'depth-type': 'from location',
            'num-phases-used': '54',
            'minimum-distance': '1.218',
          },
        },
      ],
    },
  },
};
