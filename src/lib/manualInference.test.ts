import{describe,expect,it}from'vitest'
import{inferStyle}from'./normalize'
describe('manual entry inference',()=>{it.each([['28 F-16 JERSEY','JERSEY'],['28 LITE WMN PANT','PANT'],['28 EVO GLOVE','GLOVE']] as const)('%s → %s',(style,type)=>expect(inferStyle(style).item_type).toBe(type))})
