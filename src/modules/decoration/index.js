'http://res.cloudinary.com/mplustms/image/upload/v1519928183/pnthdtsnabaxowkem2vd.jpg',
'http://res.cloudinary.com/mplustms/image/upload/v1519928094/lrngveakpkhzre0y6evf.jpg',
'http://res.cloudinary.com/mplustms/image/upload/v1519927989/s4lmnriknrfocwnso8jl.jpg',
'http://res.cloudinary.com/mplustms/image/upload/v1519927986/hrzbxs4897xxwe28i9f9.jpg',
'http://res.cloudinary.com/mplustms/image/upload/v1519927133/yyo11twc6wsmalbteodg.jpg',
'http://res.cloudinary.com/mplustms/image/upload/v1519927182/leopdqpabk7q7uini6xi.jpg',
'http://res.cloudinary.com/mplustms/image/upload/v1519927226/cvc9cl9ysb6aaj0jsdau.jpg',
'http://res.cloudinary.com/mplustms/image/upload/v1519927305/ukmxnlazox8ezawk9yxe.jpg',
'http://res.cloudinary.com/mplustms/image/upload/v1519927522/i4c8duacrvn1xjsi1oie.jpg',
'http://res.cloudinary.com/mplustms/image/upload/v1519927783/nsvufazwyoncw3lh0bqp.jpg',
'http://res.cloudinary.com/mplustms/image/upload/v1519927828/ypvz5hfqf8qwfov2gxmw.jpg',
'http://res.cloudinary.com/mplustms/image/upload/v1519927902/ybauugxofklqjzz7tu3g.jpg',
'http://res.cloudinary.com/mplustms/image/upload/v1519927964/wrvebn80ymtksoidh4r2.jpg'

const pickLoggedOutDesign = () => {
  const designs = [{
      cover: 'http://res.cloudinary.com/mplustms/image/upload/v1519928183/pnthdtsnabaxowkem2vd.jpg',
      bgcolor: 'white',
      fgcolor: 'black'
    },
    {
      cover: 'http://res.cloudinary.com/mplustms/image/upload/v1519928094/lrngveakpkhzre0y6evf.jpg',
      bgcolor: 'rgb(255, 45, 88)',
      fgcolor: 'white'
    },
    {
      cover: 'http://res.cloudinary.com/mplustms/image/upload/v1519927989/s4lmnriknrfocwnso8jl.jpg',
      bgcolor: 'rgb(94, 253, 87)',
      fgcolor: 'black'
    },
    {
      cover: 'http://res.cloudinary.com/mplustms/image/upload/v1519927986/hrzbxs4897xxwe28i9f9.jpg',
      bgcolor: 'rgb(8, 60, 79)',
      fgcolor: 'white'
    },
    {
      cover: 'http://res.cloudinary.com/mplustms/image/upload/v1519927133/yyo11twc6wsmalbteodg.jpg',
      bgcolor: 'rgb(4, 102, 223)',
      fgcolor: 'white'
    },
    {
      cover: 'http://res.cloudinary.com/mplustms/image/upload/v1519927182/leopdqpabk7q7uini6xi.jpg',
      bgcolor: 'rgb(255, 244, 88)',
      fgcolor: 'black'
    },
    {
      cover: 'http://res.cloudinary.com/mplustms/image/upload/v1519927305/ukmxnlazox8ezawk9yxe.jpg',
      bgcolor: 'rgb(255, 244, 88)',
      fgcolor: 'black'
    },
    {
      cover: 'http://res.cloudinary.com/mplustms/image/upload/v1519927522/i4c8duacrvn1xjsi1oie.jpg',
      bgcolor: 'rgb(255, 244, 88)',
      fgcolor: 'black'
    },
    {
      cover: 'http://res.cloudinary.com/mplustms/image/upload/v1519927783/nsvufazwyoncw3lh0bqp.jpg',
      bgcolor: 'rgb(255, 244, 88)',
      fgcolor: 'black'
    },
    {
      cover: 'http://res.cloudinary.com/mplustms/image/upload/v1519927828/ypvz5hfqf8qwfov2gxmw.jpg',
      bgcolor: 'rgb(255, 244, 88)',
      fgcolor: 'black'
    },
    {
      cover: 'http://res.cloudinary.com/mplustms/image/upload/v1519927902/ybauugxofklqjzz7tu3g.jpg',
      bgcolor: 'rgb(255, 244, 88)',
      fgcolor: 'black'
    },
    {
      cover: 'http://res.cloudinary.com/mplustms/image/upload/v1519927964/wrvebn80ymtksoidh4r2.jpg',
      bgcolor: 'rgb(255, 244, 88)',
      fgcolor: 'black'
    },
    {
      cover: 'http://res.cloudinary.com/mplustms/image/upload/v1519927226/cvc9cl9ysb6aaj0jsdau.jpg',
      bgcolor: 'rgb(242, 90, 50)',
      fgcolor: 'white'
    }
  ]
  return designs[Math.floor(Math.random() * designs.length)]
}
exports.pickLoggedOutDesign = pickLoggedOutDesign